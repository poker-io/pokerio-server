import { runRequestWithClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import type { BasicPlayerInfo } from '../utils/types'
import sha256 from 'crypto-js/sha256'
import {
  deletePlayer,
  getPlayersInGame,
  getGameIdAndStatus,
} from '../utils/commonRequest'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.get(
  '/kickPlayer',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('creatorToken'),
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
    }),
  }),
  async (req, res) => {
    const creatorToken = req.query.creatorToken as string
    const playerToken = req.query.playerToken as string

    if (creatorToken === playerToken || !(await verifyFCMToken(creatorToken))) {
      return res.sendStatus(401)
    }

    await runRequestWithClient(res, async (client) => {
      const gameId = (await getGameIdAndStatus(creatorToken, client)).gameId
      if (gameId === null) {
        return res.sendStatus(402)
      }

      const players = await getPlayersInGame(gameId, client)

      const kickedPlayerToken = getKickedPlayerToken(playerToken, players)
      if (kickedPlayerToken === null) {
        return res.sendStatus(403)
      }

      await deletePlayer(kickedPlayerToken, client)

      await notifyPlayers(playerToken, players)

      // TODO: Fix game state

      return res.sendStatus(200)
    })
  }
)

function getKickedPlayerToken(
  playerHash: string,
  players: BasicPlayerInfo[]
): string | null {
  let token: string | null = null
  players.forEach((player) => {
    if (sha256(player.token).toString() === playerHash) {
      token = player.token
    }
  })
  return token
}

async function notifyPlayers(playerHash: string, players: BasicPlayerInfo[]) {
  const message = {
    data: {
      type: 'playerKicked',
      playerHash,
    },
    token: '',
  }

  players.forEach(async (player) => {
    message.token = player.token
    await sendFirebaseMessage(message)
  })
}

export default router
