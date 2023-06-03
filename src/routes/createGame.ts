import { runRequestWithClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../utils/firebase'
import {
  STARTING_FUNDS_DEFAULT,
  SMALL_BLIND_DEFAULT,
  isPlayerInAnyGame,
  createPlayer,
} from '../utils/commonRequest'
import type { BasicPlayerInfo, NewGameInfo } from '../utils/types'
import { type PoolClient } from 'pg'
import express, { type Router } from 'express'
import { rateLimiter } from '../utils/rateLimiter'
const router: Router = express.Router()

router.get(
  '/createGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('creatorToken'),
      nickname: Joi.string().required().max(20).label('nickname'),
      startingFunds: Joi.number().min(1).label('startingFunds'),
      smallBlind: Joi.number().min(1).label('smallBlind'),
    }),
  }),
  async (req, res) => {
    const creator: BasicPlayerInfo = {
      token: req.query.creatorToken as string,
      nickname: req.query.nickname as string,
    }
    const smallBlind = getSmallBlind(req)
    const startingFunds = getStartingFunds(req)

    if (!(await verifyFCMToken(creator.token))) {
      return res.sendStatus(401)
    }

    await runRequestWithClient(res, async (client) => {
      if (await isPlayerInAnyGame(creator.token, client)) {
        return res.sendStatus(402)
      }

      await createPlayer(creator, null, client)

      const gameId = await createGame(
        creator.token,
        startingFunds,
        smallBlind,
        client
      )

      await setPlayerGameId(creator.token, gameId, client)

      const newGame: NewGameInfo = {
        gameId: parseInt(gameId),
        startingFunds: parseInt(startingFunds),
        smallBlind: parseInt(smallBlind),
      }

      res.send(newGame)
    })
  }
)

function getSmallBlind(req): string {
  return req.query.smallBlind === undefined
    ? SMALL_BLIND_DEFAULT.toString()
    : (req.query.smallBlind as string)
}

function getStartingFunds(req) {
  return req.query.startingFunds === undefined
    ? STARTING_FUNDS_DEFAULT.toString()
    : (req.query.startingFunds as string)
}

async function createGame(
  creatorToken: string,
  startingFunds: string,
  smallBlind: string,
  client: PoolClient
): Promise<string> {
  const query = `SELECT * FROM insert_with_random_key($1, $2, $3, $4, 
        $5, $6, $7, $8, $9, $10, $11, $12)`
  const values = [
    creatorToken,
    null,
    null,
    null,
    null,
    null,
    0,
    startingFunds,
    smallBlind,
    null,
    0,
    null,
  ]
  return (await client.query(query, values)).rows[0].insert_with_random_key
}

async function setPlayerGameId(
  playerToken: string,
  gameId: string,
  client: PoolClient
) {
  const query = 'UPDATE Players SET game_id=$1 WHERE token=$2'
  const values = [gameId, playerToken]
  await client.query(query, values)
}

export default router
