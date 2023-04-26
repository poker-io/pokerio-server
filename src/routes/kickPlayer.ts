import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../utils/firebase'

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
      playerToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('playerToken'),
    }),
  }),
  async (req, res) => {
    if (!(await verifyFCMToken(req.query.creatorToken) && await verifyFCMToken(req.query.playerToken)) || req.query.creatorToken === req.query.playerToken) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        const getGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
        const verifyPlayerInGameQuery = 'SELECT token FROM Players WHERE token=$1 AND game_id=$2'
        const removePlayerFromGameQuery = 'DELETE FROM Players WHERE token=$1'
        const getNewSmallBlindCurrentPlayer = 'SELECT token FROM Players WHERE turn IN (SELECT MIN(turn) FROM Players WHERE token!=$1 ) AND game_id=$2 LIMIT 1'
        const setNewSmallBlindCurrentPlayerQuery = 'UPDATE Games SET small_blind_who=$1, current_player=$2 WHERE game_id=$3'

        await client.query(getGameQuery, [req.query.creatorToken]).then(async (getGameRes) => {
          if (getGameRes.rowCount === 0) {
            return res.sendStatus(400)
          }
          await client
            .query(verifyPlayerInGameQuery, [req.query.playerToken, getGameRes.rows[0].game_id])
            .then(async (verifyRes) => {
              if (verifyRes.rowCount === 0) {
                return res.sendStatus(400)
              }

              await client.query(getNewSmallBlindCurrentPlayer, [req.query.playerToken, getGameRes.rows[0].game_id]).then(async (playerToReplace) => {
                await client.query(setNewSmallBlindCurrentPlayerQuery, [playerToReplace.rows[0].token, playerToReplace.rows[0].token, getGameRes.rows[0].game_id])
                await client.query(removePlayerFromGameQuery, [req.query.playerToken])

                res.sendStatus(200)
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
