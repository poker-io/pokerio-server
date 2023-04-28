import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'

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
      !(await verifyFCMToken(req.query.creatorToken)) &&
      req.query.creatorToken === req.query.playerToken
    ) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // Define queries
        const getGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
        const verifyPlayerInGameQuery =
          'SELECT token FROM Players WHERE token=$1 AND game_id=$2'
        const getPlayersQuery = 'SELECT token FROM Players WHERE game_id=$1'
        const deletePlayerQuery = 'DELETE FROM Players WHERE token=$1'

        // Check if game exists
        const getGameResult = await client.query(getGameQuery, [
          req.query.creatorToken,
        ])

        if (getGameResult.rowCount === 0) {
          return res.sendStatus(400)
        }
        const gameId = getGameResult.rows[0].game_id

        const verifyPlayerInGameResult = await client.query(
          verifyPlayerInGameQuery,
          [req.query.playerToken, gameId]
        )

        if (verifyPlayerInGameResult.rowCount === 0) {
          return res.sendStatus(400)
        }

        const getPlayersResult = await client.query(getPlayersQuery, [gameId])

        getPlayersResult.rows.forEach(async (row) => {
          if (sha256(row.token) === req.query.playerToken) {
            await client.query(deletePlayerQuery, [row.token])
          }

          // TODO: Send message (after PR #35 is merged)
        })

        res.sendStatus(200)
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
