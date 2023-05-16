import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import { type Client } from 'pg'
import { getPlayersInGame } from '../utils/commonRequest'

import express, { type Router } from 'express'
import type { SimpPlayer } from '../utils/types'
const router: Router = express.Router()

router.get(
  '/modifyGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('creatorToken'),
      smallBlind: Joi.number().required().min(1).label('smallBlind'),
      startingFunds: Joi.number().required().min(1).label('startingFunds'),
    }),
  }),
  async (req, res) => {
    if (!(await verifyFCMToken(req.query.creatorToken))) {
      return res.sendStatus(401)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // We already know that all request values are defined
        const creatorToken = req.query.creatorToken as string
        const smallBlind = req.query.smallBlind as string
        const startingFunds = req.query.startingFunds as string

        const gameId = await getGameIdIfNotStarted(creatorToken, client)
        if (gameId === null) {
          return res.sendStatus(400)
        }

        await updateGameSettings(gameId, startingFunds, smallBlind, client)

        const players = await getPlayersInGame(gameId, client)

        await notifyPlayers(startingFunds, smallBlind, players)

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

async function getGameIdIfNotStarted(
  gameMaster: string,
  client: Client
): Promise<string | null> {
  const query =
    'SELECT game_id FROM Games WHERE game_master=$1 AND current_player IS NULL'
  const result = await client.query(query, [gameMaster])
  return result.rowCount === 0 ? null : result.rows[0].game_id
}

async function updateGameSettings(
  gameId: string,
  startingFunds: string,
  smallBlind: string,
  client: Client
) {
  const query =
    'UPDATE Games SET  small_blind=$1, starting_funds=$2 WHERE game_id=$3'
  const values = [smallBlind, startingFunds, gameId]
  await client.query(query, values)
}

async function notifyPlayers(
  startingFunds: string,
  smallBlind: string,
  players: SimpPlayer[]
) {
  const message = {
    data: {
      type: 'settingsUpdated',
      startingFunds,
      smallBlind,
    },
    token: '',
  }

  players.forEach(async (player) => {
    message.token = player.token
    await sendFirebaseMessage(message)
  })
}

export default router
