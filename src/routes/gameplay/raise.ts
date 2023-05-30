import { runRequestWithClient } from '../../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import {
  sendFirebaseMessageToEveryone,
  verifyFCMToken,
} from '../../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../../utils/rateLimiter'
import {
  isPlayerInGame,
  isPlayersTurn,
  setPlayerState,
  setNewCurrentPlayer,
  changeGameRoundIfNeeded,
  playerHasEnoughMoney,
  isRaising,
  playerRaised,
} from '../../utils/commonRequest'
import sha256 from 'crypto-js/sha256'
import { PlayerState } from '../../utils/types'

const router: Router = express.Router()

router.get(
  '/actionRaise',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'),
      amount: Joi.number().required().min(1).label('amount'),
    }),
  }),
  async (req, res) => {
    const playerToken = req.query.playerToken as string
    const gameId = req.query.gameId as string
    const amount = req.query.amount as string
    if (!(await verifyFCMToken(playerToken))) {
      return res.sendStatus(401)
    }

    await runRequestWithClient(res, async (client) => {
      if (!(await isPlayerInGame(playerToken, gameId, client))) {
        return res.sendStatus(400)
      }

      if (!(await isPlayersTurn(playerToken, gameId, client))) {
        return res.sendStatus(402)
      }

      if (!(await playerHasEnoughMoney(gameId, playerToken, amount, client))) {
        return res.sendStatus(403)
      }

      if (!(await isRaising(gameId, amount, client))) {
        return res.sendStatus(404)
      }

      const newPlayer = await setNewCurrentPlayer(playerToken, gameId, client)

      await playerRaised(gameId, playerToken, amount, client)
      await setPlayerState(playerToken, client, PlayerState.Raised)
      await changeGameRoundIfNeeded(gameId, newPlayer, client)

      const message = {
        data: {
          player: sha256(playerToken).toString(),
          type: PlayerState.Raised,
          actionPayload: amount.toString(),
        },
        token: '',
      }

      await sendFirebaseMessageToEveryone(message, gameId, client)
      res.sendStatus(200)
    })
  }
)

export default router
