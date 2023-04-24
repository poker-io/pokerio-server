import { getClient } from './databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import {
  startingFundsDefault,
  smallBlindDefault,
  type newGameInfo,
} from './app'
import { verifyFCMToken } from './firebase'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.get(
  '/createGame',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('creatorToken'),
      nickname: Joi.string().required().max(20).label('Nickname'),
      startingFunds: Joi.number().min(1).label('Starting Funds'),
      smallBlind: Joi.number().min(1).label('Small Blind'),
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
        const createPlayerQuery =
          'INSERT INTO Players(token, nickname, turn, game_id, card1, card2, funds, bet) VALUES($1, $2, $3, $4, $5, $6, $7, $8)'
        const createPlayerValues = [
          req.query.creatorToken,
          req.query.nickname,
          0,
          null,
          null,
          null,
          null,
          null,
        ]

        const createGameQuery =
          'SELECT * FROM insert_with_random_key($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) '
        const values = [
          req.query.creatorToken,
          null,
          null,
          null,
          null,
          null,
          0,
          req.query.startingFunds ?? startingFundsDefault,
          req.query.smallBlind ?? smallBlindDefault,
          req.query.creatorToken,
          0,
          req.query.creatorToken,
        ]

        await client.query(createPlayerQuery, createPlayerValues)
        await client.query(createGameQuery, values).then(async (result) => {
          await client
            .query('UPDATE Players SET game_id=$1 WHERE token=$2', [
              result.rows[0].insert_with_random_key,
              req.query.creatorToken,
            ])
            .then(() => {
              const newGame: newGameInfo = {
                gameKey: result.rows[0].insert_with_random_key,
                startingFunds: startingFundsDefault,
                smallBlind: smallBlindDefault,
              }
              if (req.query.startingFunds !== undefined) {
                newGame.startingFunds = parseInt(
                  req.query.startingFunds as string
                )
              }
              if (req.query.smallBlind !== undefined) {
                newGame.smallBlind = parseInt(req.query.smallBlind as string)
              }
              res.send(newGame)
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
