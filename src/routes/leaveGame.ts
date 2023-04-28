import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.get(
  '/kickPlayer',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
    }),
  }),
  async (req, res) => {
    if (!await verifyFCMToken(req.query.playerToken)) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        const getGameId = 'SELECT game_id FROM Players WHERE token=$1'
        const removePlayer = 'DELETE FROM Players WHERE token=$1'
        const getPlayerTokens = 'SELECT token FROM Players WHERE game_id=$1'

        await client
          .query(getGameId, [req.query.creatorToken])
          .then(async (getGameIdResult) => {
            if (getGameIdResult.rowCount === 0) {
              return res.sendStatus(400)
            }
            const message = {
              data: {
                type: 'playerLeft',
                // We know that the nickname will be defined
                // because we checked it with celebrate.
                playerHash: sha256(req.query.playerToken).toString(),
              },
              token: '',
            }
            await client.query(removePlayer, [req.query.playerToken])
            await client.query(
              getPlayerTokens,
              [getGameIdResult.rows[0].game_id]
            ).then((tokensResult) => {
              tokensResult.rows.forEach(async (row) => {
                message.token = row.token
                await sendFirebaseMessage(message)
              })
            })
          })
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
