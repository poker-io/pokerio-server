import { getClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import {
  startingFundsDefault,
  smallBlindDefault,
  type NewGameInfo,
} from '../app'
import { verifyFCMToken } from '../utils/firebase'
import { playerInGame, createPlayer } from '../utils/commonRequest'
import { type Client } from 'pg'
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
    if (!(await verifyFCMToken(req.query.creatorToken))) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // We already know that these request values are defined
        const creatorToken = req.query.creatorToken as string
        const nickname = req.query.nickname as string

        const smallBlind =
          req.query.smallBlind === undefined
            ? smallBlindDefault.toString()
            : (req.query.smallBlind as string)
        const startingFunds =
          req.query.startingFunds === undefined
            ? startingFundsDefault.toString()
            : (req.query.startingFunds as string)

        if (await playerInGame(creatorToken, client)) {
          return res.sendStatus(400)
        }

        await createPlayer(creatorToken, nickname, null, client)

        const gameKey = await createGame(
          creatorToken,
          nickname,
          startingFunds,
          smallBlind,
          client
        )

        await updatePlayer(creatorToken, gameKey, client)

        const newGame: NewGameInfo = {
          gameKey: parseInt(gameKey),
          startingFunds: parseInt(startingFunds),
          smallBlind: parseInt(smallBlind),
        }
        res.send(newGame)
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

async function createGame(
  creatorToken: string,
  nickname: string,
  startingFunds: string,
  smallBlind: string,
  client: Client
): Promise<string> {
  const createGameQuery = `SELECT * FROM insert_with_random_key($1, $2, $3, $4, 
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
  return (await client.query(createGameQuery, values)).rows[0]
    .insert_with_random_key
}

async function updatePlayer(
  playerToken: string,
  gameKey: string,
  client: Client
) {
  const updatePlayerQuery = 'UPDATE Players SET game_id=$1 WHERE token=$2'
  const updatePlayerValues = [gameKey, playerToken]
  await client.query(updatePlayerQuery, updatePlayerValues)
}

export default router
