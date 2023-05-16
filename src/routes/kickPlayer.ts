import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'
import { type Client } from 'pg'
import { deletePlayer, getPlayersInGameTokens } from '../utils/commonRequest'

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
    if (
      req.query.creatorToken === req.query.playerToken ||
      !(await verifyFCMToken(req.query.creatorToken))
    ) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // We already know that all request values are defined
        const creatorToken = req.query.creatorToken as string
        const playerToken = req.query.playerToken as string

        const gameId = await getGameId(creatorToken, client)
        if (gameId === null) {
          return res.sendStatus(400)
        }

        const players = await getPlayersInGameTokens(gameId, client)

        const kickedPlayerToken = await getKickedPlayerToken(
          playerToken,
          players,
          client
        )
        if (kickedPlayerToken === null) {
          return res.sendStatus(400)
        }

        await deletePlayer(kickedPlayerToken, client)

        await notifyPlayers(playerToken, players, client)

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

async function getKickedPlayerToken(
  playerHash: string,
  players: Array<{ token: string }>,
  client: Client
): Promise<string | null> {
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
  players: Array<{ token: string }>,
  client: Client
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
