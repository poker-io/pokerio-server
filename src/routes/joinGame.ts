import { runRequestWithClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import sha256 from 'crypto-js/sha256'
import type { GameLobbyData, BasicPlayerInfo } from '../utils/types'
import {
  sendFirebaseMessageToEveryone,
  verifyFCMToken,
} from '../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../utils/rateLimiter'
import { type PoolClient } from 'pg'
import {
  isPlayerInAnyGame,
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
    const gameId = req.query.gameId as string
    const newPlayer: BasicPlayerInfo = {
      nickname: req.query.nickname as string,
      token: req.query.playerToken as string,
    }

    if (!(await verifyFCMToken(newPlayer.token))) {
      return res.sendStatus(401)
    }

    await runRequestWithClient(res, async (client) => {
      if (await isPlayerInAnyGame(newPlayer.token, client)) {
        return res.sendStatus(400)
      }

      if (!(await isGameJoinable(gameId, client))) {
        return res.sendStatus(402)
      }

      const gameInfo = await getGameInfo(gameId, client)
      const players = await getPlayersInGame(gameId, client)
      addPlayersToGameInfo(gameInfo, players)

      await sendPlayerJoinedFirebaseMessage(newPlayer, gameId, client)

      await createPlayer(newPlayer, gameId, client)
      res.send(gameInfo)
    })
  }
)

async function isGameJoinable(gameId: string, client: PoolClient) {
  const query = `SELECT game_master 
                 FROM Games g JOIN Players p ON g.game_id = p.game_id 
                 WHERE g.game_id = $1 AND g.current_player IS NULL
                 GROUP BY g.game_id HAVING COUNT(p.token) < $2`

  return (await client.query(query, [gameId, MAX_PLAYERS])).rowCount !== 0
}

async function getGameInfo(gameId: string, client: PoolClient) {
  const query = 'SELECT * FROM Games WHERE game_id=$1'
  const result = await client.query(query, [gameId])

  const gameInfo: GameLobbyData = {
    smallBlind: parseInt(result.rows[0].small_blind),
    startingFunds: parseInt(result.rows[0].starting_funds),
    players: [],
    gameMasterHash: sha256(result.rows[0].game_master).toString(),
  }

  return gameInfo
}

function addPlayersToGameInfo(
  gameInfo: GameLobbyData,
  players: BasicPlayerInfo[]
) {
  players.forEach((player) => {
    gameInfo.players.push({
      nickname: player.nickname,
      playerHash: sha256(player.token).toString(),
      turn: TURN_DEFAULT,
    })
  })
}

async function sendPlayerJoinedFirebaseMessage(
  player: BasicPlayerInfo,
  gameId: string,
  client: PoolClient
) {
  const message = {
    data: {
      type: 'playerJoined',
      nickname: player.nickname,
      playerHash: sha256(player.token).toString(),
    },
    token: '',
  }

  await sendFirebaseMessageToEveryone(message, gameId, client)
}

export default router
