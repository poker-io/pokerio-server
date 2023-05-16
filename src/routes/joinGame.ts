import { getClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import sha256 from 'crypto-js/sha256'
import type { GameLobbyData, FirebaseSimpPlayer } from '../utils/types'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../utils/rateLimiter'
import { type Client } from 'pg'
import {
  isPlayerInGame,
  createPlayer,
  getPlayersInGame,
  MAX_PLAYERS,
  TURN_DEFAULT,
} from '../utils/commonRequest'

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
    const playerToken = req.query.playerToken as string
    const nickname = req.query.nickname as string
    const gameId = req.query.gameId as string

    if (!(await verifyFCMToken(playerToken))) {
      return res.sendStatus(401)
    }

    const client = getClient()

    client
      .connect()
      .then(async () => {
        if (await isPlayerInGame(playerToken, client)) {
          return res.sendStatus(400)
        }

        if (!(await isGameJoinable(gameId, client))) {
          return res.sendStatus(402)
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
  const query = `SELECT game_master FROM Games g 
            join Players p on g.game_id = p.game_id 
            WHERE g.game_id = $1 and g.current_player IS NULL
            group by g.game_id having count(p.token) < $2`
  const values = [gameId, MAX_PLAYERS]
  return (await client.query(query, values)).rowCount !== 0
}

async function getGameInfo(gameId: string, client: Client) {
  const query = 'SELECT * FROM Games WHERE game_id=$1'

  const gameInfo: GameLobbyData = {
    smallBlind: 0,
    startingFunds: 0,
    players: [],
    gameMasterHash: '',
  }
  const result = await client.query(query, [gameId])
  gameInfo.smallBlind = parseInt(result.rows[0].small_blind)
  gameInfo.startingFunds = parseInt(result.rows[0].starting_funds)
  gameInfo.gameMasterHash = sha256(result.rows[0].game_master).toString()
  return gameInfo
}

async function completeInfoAndNotifyPlayers(
  gameInfo: GameLobbyData,
  nickname: string,
  playerToken: string,
  players: FirebaseSimpPlayer[]
) {
  const message = {
    data: {
      type: 'playerJoined',
      nickname,
      playerHash: sha256(playerToken).toString(),
    },
    token: '',
  }

  players.forEach(async (player) => {
    gameInfo.players.push({
      nickname: player.nickname,
      playerHash: sha256(player.token).toString(),
      turn: TURN_DEFAULT,
    })
    message.token = player.token
    await sendFirebaseMessage(message)
  })
}

export default router
