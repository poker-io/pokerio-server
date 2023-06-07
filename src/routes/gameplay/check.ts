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
} from '../../utils/commonRequest'
import { type PoolClient } from 'pg'
import sha256 from 'crypto-js/sha256'
import { PlayerState } from '../../utils/types'

const router: Router = express.Router()

router.get(
  '/actionCheck',
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

      if (!(await hasPlayerBetEnough(playerToken, gameId, client))) {
        return res.sendStatus(404)
      }

      await setPlayerState(playerToken, client, PlayerState.Checked)
      await changeCurrentPlayer(playerToken, gameId, client)

      const message = {
        data: {
          player: sha256(playerToken).toString(),
          type: PlayerState.Checked,
          actionPayload: '',
        },
        token: '',
      }

      await sendFirebaseMessageToEveryone(message, gameId, client)
      await changeGameRoundIfNeeded(gameId, client)
      return res.sendStatus(200)
    })
  }
)

async function getMaxBet(gameId: string, client: PoolClient) {
  const query =
    'SELECT bet FROM Players WHERE game_id = $1 AND bet is not NULL order by bet desc limit 1'
  return (await client.query(query, [gameId])).rows[0].bet
}

async function getPlayerBet(playerId: string, client: PoolClient) {
  const query = 'SELECT bet FROM Players WHERE token = $1'
  return (await client.query(query, [playerId])).rows[0].bet
}

async function hasPlayerBetEnough(
  playerId: string,
  gameId: string,
  client: PoolClient
) {
  const maxBet = await getMaxBet(gameId, client)
  const playerBet = await getPlayerBet(playerId, client)
  return playerBet >= maxBet
}

export default router
