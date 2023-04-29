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
        // Define queries
        const getGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
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

        // Verify player is in game and kick
        const getPlayersResult = await client.query(getPlayersQuery, [gameId])
        let playerInGame = false
        let kickedPlayerToken = ''

        getPlayersResult.rows.forEach((row) => {
          if (sha256(row.token).toString() === req.query.playerToken) {
            playerInGame = true
            kickedPlayerToken = row.token
          }
        })

        if (!playerInGame) {
          return res.sendStatus(400)
        }

        await client.query(deletePlayerQuery, [kickedPlayerToken])

        // Notify players about the changes
        const message = {
          data: {
            type: 'playerKicked',
            playerHash: req.query.playerToken,
          },
          token: '',
        }
        getPlayersResult.rows.forEach(async (row) => {
          message.token = row.token
          await sendFirebaseMessage(message)
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
