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
  changeCurrentPlayer,
  changeGameRoundIfNeeded,
  gameEnd,
} from '../../utils/commonRequest'
import sha256 from 'crypto-js/sha256'
import { PlayerState } from '../../utils/types'

const router: Router = express.Router()

router.get(
  '/actionFold',
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

    await runRequestWithClient(res, async (client) => {
      if (!(await isPlayerInGame(playerToken, gameId, client))) {
        return res.sendStatus(402)
      }

      if (!(await isPlayersTurn(playerToken, gameId, client))) {
        return res.sendStatus(403)
      }
      await setPlayerState(playerToken, client, PlayerState.Folded)
      const newPlayer = await changeCurrentPlayer(playerToken, gameId, client)
      if (newPlayer === '') {
        await gameEnd(gameId, client)
        return res.sendStatus(201)
      }

      const message = {
        data: {
          player: sha256(playerToken).toString(),
          type: PlayerState.Folded,
          actionPayload: '',
        },
        token: '',
      }

      await sendFirebaseMessageToEveryone(message, gameId, client)
      await changeGameRoundIfNeeded(gameId, client)
      res.sendStatus(200)
    })
  }
)

export default router
