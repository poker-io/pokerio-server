import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../utils/firebase'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.post(
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
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // Define queries
        const getGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
        const setNewSmallBlindStartingFunds =
          'UPDATE Games SET  small_blind=$1, starting_funds=$2 WHERE game_id=$3'

        // Check if games exist
        const getGameResult = await client.query(getGameQuery, [
          req.query.creatorToken,
        ])

        if (getGameResult.rowCount === 0) {
          return res.sendStatus(400)
        }
        const gameId = getGameResult.rows[0].game_id

        // Update settings
        await client.query(setNewSmallBlindStartingFunds, [
          req.query.smallBlind,
          req.query.startingFunds,
          gameId,
        ])

        // TODO: Send message (after PR #35 is merged)

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

export default router
