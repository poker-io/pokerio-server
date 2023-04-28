import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.get(
  '/leaveGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
    }),
  }),
  async (req, res) => {
    if (!(await verifyFCMToken(req.query.playerToken))) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // Define queries
        const getGameIdQuery = 'SELECT game_id FROM Players WHERE token=$1'
        const getGameMasterQuery =
          'SELECT game_master FROM Games WHERE game_id=$1'
        const updateGameMasterQuery =
          'UPDATE Games SET game_master=$1 WHERE game_id=$2'
        const removePlayerQuery = 'DELETE FROM Players WHERE token=$1'
        const getPlayerTokensQuery =
          'SELECT token FROM Players WHERE game_id=$1'
        const deleteGameQuery = 'DELETE FROM Games WHERE game_id=$1'

        // Check if the player is in the database
        const getGameIdResult = await client.query(getGameIdQuery, [
          req.query.playerToken,
        ])
        if (getGameIdResult.rowCount === 0) {
          return res.sendStatus(400)
        }
        const gameId = getGameIdResult.rows[0].game_id

        const playersResult = await client.query(getPlayerTokensQuery, [gameId])

        // Check if player is game master
        const gameMasterResult = await client.query(getGameMasterQuery, [
          gameId,
        ])
        let gameMaster = gameMasterResult.rows[0].game_master
        if (gameMaster === req.query.playerToken) {
          // If game master is last in game
          if (playersResult.rowCount === 1) {
            await client.query(deleteGameQuery, [gameId])
            await client.query(removePlayerQuery, [req.query.playerToken])

            return res.sendStatus(200)
          } else {
            for (let i = 0; gameMaster === req.query.playerToken; i++) {
              gameMaster = playersResult.rows[i].token
            }

            await client.query(updateGameMasterQuery, [gameMaster, gameId])
          }
        }
        await client.query(removePlayerQuery, [req.query.playerToken])

        // Notify players about the changes
        const message = {
          data: {
            type: 'playerLeft',
            playerHash: sha256(req.query.playerToken).toString(),
            gameMaster: sha256(gameMaster),
          },
          token: '',
        }

        playersResult.rows.forEach(async (row) => {
          message.token = row.token
          await sendFirebaseMessage(message)
        })

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

export default router
