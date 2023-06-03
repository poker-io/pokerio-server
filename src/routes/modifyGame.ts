import { runRequestWithClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import {
  sendFirebaseMessageToEveryone,
  verifyFCMToken,
} from '../utils/firebase'
import { type PoolClient } from 'pg'
import { getGameIdStatus } from '../utils/commonRequest'

import express, { type Router } from 'express'
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
    const creatorToken = req.query.creatorToken as string
    const smallBlind = req.query.smallBlind as string
    const startingFunds = req.query.startingFunds as string

    if (!(await verifyFCMToken(creatorToken))) {
      return res.sendStatus(401)
    }

    await runRequestWithClient(res, async (client) => {
      const { gameId, started } = await getGameIdStatus(creatorToken, client)
      if (gameId === null || started) {
        return res.sendStatus(402)
      }

      await updateGameSettings(gameId, startingFunds, smallBlind, client)

      const message = {
        data: {
          type: 'settingsUpdated',
          startingFunds: startingFunds.toString(),
          smallBlind: smallBlind.toString(),
        },
        token: '',
      }

      await sendFirebaseMessageToEveryone(message, gameId, client)

      return res.sendStatus(200)
    })
  }
)

async function updateGameSettings(
  gameId: string,
  startingFunds: string,
  smallBlind: string,
  client: PoolClient
) {
  const query =
    'UPDATE Games SET  small_blind=$1, starting_funds=$2 WHERE game_id=$3'
  const values = [smallBlind, startingFunds, gameId]
  await client.query(query, values)
}

export default router
