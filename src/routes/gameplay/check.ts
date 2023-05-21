import { getClient } from '../../utils/databaseConnection'
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
} from '../../utils/commonRequest'
import { type Client } from 'pg'
import sha256 from 'crypto-js/sha256'
import { PlayerState } from '../../utils/types'

const router: Router = express.Router()

router.get(
  '/check',
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
          return res.sendStatus(402)
        }

        if (!(await hasPlayerBetEnough(playerToken, gameId, client))) {
          return res.sendStatus(403)
        }

        await setPlayerState(playerToken, client, PlayerState.Checked)
        const newPlayer = await setNewCurrentPlayer(playerToken, gameId, client)
        await changeGameRoundIfNeeded(gameId, newPlayer, client)

        const message = {
          data: {
            player: sha256(playerToken).toString(),
            type: PlayerState.Checked,
            actionPayload: '',
          },
          token: '',
        }

        await sendFirebaseMessageToEveryone(message, gameId, client)

        return res.sendStatus(200)
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

async function getMaxBet(gameId: string, client: Client) {
  const query =
    'SELECT bet FROM Players WHERE game_id = $1 AND bet is not NULL order by bet desc limit 1'
  return (await client.query(query, [gameId])).rows[0].bet
}

async function getPlayerBet(playerId: string, client: Client) {
  const query = 'SELECT bet FROM Players WHERE token = $1'
  return (await client.query(query, [playerId])).rows[0].bet
}

async function hasPlayerBetEnough(
  playerId: string,
  gameId: string,
  client: Client
) {
  const maxBet = await getMaxBet(gameId, client)
  const playerBet = await getPlayerBet(playerId, client)
  return playerBet >= maxBet
}

export default router
