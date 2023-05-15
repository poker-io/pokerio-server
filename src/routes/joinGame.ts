import { getClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import sha256 from 'crypto-js/sha256'
import { type GameSettings } from '../app'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../utils/rateLimiter'
import { type Client } from 'pg'

const router: Router = express.Router()

router.get(
  '/joinGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      nickname: Joi.string().required().max(20).label('nickname'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'),
    }),
  }),
  async (req, res) => {
    if (!(await verifyFCMToken(req.query.playerToken))) {
      return res.sendStatus(400)
    }

    const client = getClient()

    client
      .connect()
      .then(async () => {
        // We already know that all the values are defined
        const playerToken = req.query.playerToken as string
        const nickname = req.query.nickname as string
        const gameId = req.query.gameId as string

        if (await playerInGame(playerToken, client)) {
          return res.sendStatus(400)
        }

        if (!(await isGameJoinable(gameId, client))) {
          return res.sendStatus(401)
        }

        const gameInfo = await getGameInfo(gameId, client)

        const players = await getPlayersInGame(gameId, client)

        await completeInfoAndNotifyPlayers(
          gameInfo,
          nickname,
          playerToken,
          players
        )

        await createPlayer(playerToken, nickname, gameId, client)

        res.send(gameInfo)
      })
      .catch((err) => {
        console.log(err.stack)
        return res.sendStatus(500)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

async function isGameJoinable(gameId: string, client: Client) {
  const checkIfGameIsJoinableQuery = `SELECT game_master FROM Games g 
            join Players p on g.game_id = p.game_id 
            WHERE g.game_id = $1 and g.game_round = 0
            group by g.game_id having count(p.token) < 8`
  const gameCheckValues = [gameId]
  return (
    (await client.query(checkIfGameIsJoinableQuery, gameCheckValues))
      .rowCount !== 0
  )
}

async function playerInGame(playerToken: string, client: Client) {
  const checkIfPlayerInGameQuery = 'SELECT * FROM Players WHERE token=$1'
  const playerInGameValues = [playerToken]
  return (
    (await client.query(checkIfPlayerInGameQuery, playerInGameValues))
      .rowCount !== 0
  )
}

async function createPlayer(
  playerToken: string,
  nickname: string,
  gameId: string,
  client: Client
) {
  const createPlayerQuery = `INSERT INTO Players(token, nickname, turn, 
            game_id, card1, card2, funds, bet) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
  const createPlayerValues = [
    playerToken,
    nickname,
    0,
    gameId,
    null,
    null,
    null,
    null,
  ]
  await client.query(createPlayerQuery, createPlayerValues)
}

async function getGameInfo(gameId: string, client: Client) {
  const getGameInfoQuery = 'SELECT * FROM Games WHERE game_id=$1'
  const getGameInfoValues = [gameId]

  const gameInfo: GameSettings = {
    smallBlind: 0,
    startingFunds: 0,
    players: [],
    gameMasterHash: '',
  }
  await client.query(getGameInfoQuery, getGameInfoValues).then((result) => {
    gameInfo.smallBlind = parseInt(result.rows[0].small_blind)
    gameInfo.startingFunds = parseInt(result.rows[0].starting_funds)
    gameInfo.gameMasterHash = sha256(result.rows[0].game_master).toString()
  })
  return gameInfo
}

async function getPlayersInGame(
  gameId: string,
  client: Client
): Promise<Array<{ nickname: string; token: string }>> {
  const getPlayersInGameQuery =
    'SELECT nickname, token FROM Players WHERE game_id=$1'
  const getPlayersInGameValues = [gameId]
  return (await client.query(getPlayersInGameQuery, getPlayersInGameValues))
    .rows
}

async function completeInfoAndNotifyPlayers(
  gameInfo: GameSettings,
  nickname: string,
  playerToken: string,
  players: Array<{ nickname: string; token: string }>
) {
  const message = {
    data: {
      type: 'playerJoined',
      nickname,
      playerHash: sha256(playerToken).toString(),
    },
    token: '',
  }
  players.forEach(async (row) => {
    gameInfo.players.push({
      nickname: row.nickname,
      playerHash: sha256(row.token).toString(),
    })
    message.token = row.token
    await sendFirebaseMessage(message)
  })
}

export default router
