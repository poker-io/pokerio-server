import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import type { FirebaseSimpPlayer } from '../utils/types'
import sha256 from 'crypto-js/sha256'
import { type Client } from 'pg'
import { deletePlayer, getPlayersInGame } from '../utils/commonRequest'

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

    const client = getClient()
    client
      .connect()
      .then(async () => {
        const gameId = await getGameId(creatorToken, client)
        if (gameId === null) {
          return res.sendStatus(400)
        }

        const players = await getPlayersInGame(gameId, client)

        const kickedPlayerToken = getKickedPlayerToken(playerToken, players)
        if (kickedPlayerToken === null) {
          return res.sendStatus(402)
        }

        await deletePlayer(kickedPlayerToken, client)

        await notifyPlayers(playerToken, players)

        // TODO: Fix game state

        return res.sendStatus(200)
      })
      .catch(async (err) => {
        console.log(err.stack)
        return res.sendStatus(500)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

async function getGameId(
  gameMaster: string,
  client: Client
): Promise<string | null> {
  const query = 'SELECT game_id FROM Games WHERE game_master=$1'
  const result = await client.query(query, [gameMaster])
  return result.rowCount === 0 ? null : result.rows[0].game_id
}

function getKickedPlayerToken(
  playerHash: string,
  players: FirebaseSimpPlayer[]
): string | null {
  let token: string | null = null
  players.forEach((player) => {
    if (sha256(player.token).toString() === playerHash) {
      token = player.token
    }
  })
  return token
}

async function notifyPlayers(
  playerHash: string,
  players: FirebaseSimpPlayer[]
) {
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
