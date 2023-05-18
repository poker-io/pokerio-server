import { getClient } from '../../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../../utils/rateLimiter'
import {
  isPlayerInGame,
  isPlayersTurn,
  setPlayerState,
  setNewTurn,
} from '../../utils/commonRequest'

const router: Router = express.Router()

router.get(
  '/fold',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'),
    }),
  }),
  async (req, res) => {
    const playerToken = req.query.playerToken as string
    const gameId = req.query.gameId as string

    if (!(await verifyFCMToken(playerToken))) {
      return res.sendStatus(401)
    }

    const client = getClient()

    client
      .connect()
      .then(async () => {
        if (!(await isPlayerInGame(playerToken, gameId, client))) {
          return res.sendStatus(400)
        }

        if (!(await isPlayersTurn(playerToken, gameId, client))) {
          return res.sendStatus(401)
        }

        await setNewTurn(playerToken, gameId, client)
        await setPlayerState(playerToken, client, 'folded')

        // todo let other players through firebase know
        res.send(200)
      })
      .catch((err) => {
        console.log(err.stack)
        return res.sendStatus(500)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

export default router
