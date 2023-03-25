import express from 'express'
import { celebrate, Joi } from 'celebrate'
import { getClient } from './databaseConnection'

export const app = express()
export const port = 42069

const startingFundsDefault = 1000
const smallBlindDefault = 100

function generateNewGameID(client): number {
  const max = 999999
  const min = 100000
  const selectGameQuery = 'SELECT id FROM Games WHERE game_id = '
  let gameIdBad: boolean = true
  while (gameIdBad) {
    let gameId = Math.random()
    gameId = Math.floor(gameId * (max - min)) + min
    const selectGameWithIdQuery = selectGameQuery.concat(gameId.toString())
    console.log('asd')
    client
      .query(selectGameWithIdQuery)
      .then((res) => {
        console.log(res.rows.length)
        gameIdBad = Boolean(res.rows.length)
      })
      .catch((err) => {
        console.log(err)
        gameId = 0
        gameIdBad = false
      })
  }

  return gameIdBad
}

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})

app.get(
  '/createGame',
  celebrate({
    query: Joi.object({
      creatorID: Joi.number().required().min(1),
      startingFunds: Joi.number().min(1),
      smallBlind: Joi.number().min(1),
    }),
  }),
  (req, res) => {
    const client = getClient()
    client.connect()
    const createGameQuery =
      'INSERT INTO Games(game_id, game_master, card1, card2, card3, card4, card5, game_round, starting_funds, small_blind, small_blind_who, current_table_value, current_player) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)'
    const selectQuery = 'SELECT id FROM Players WHERE id = '.concat(
      req.query.creatorID?.toString() ?? ''
    )
    let creatorExists: boolean = false

    client
      .query(selectQuery)
      .then((selectRes) => {
        creatorExists = Boolean(selectRes.rows.length)
        console.log(creatorExists.valueOf())

        if (!creatorExists) {
          res.sendStatus(400)
        }
        const gameId = generateNewGameID(client)
        if (gameId === 0) {
          res.sendStatus(500)
        }

        console.log(selectRes.rows)
        const values = [
          gameId,
          req.query.creatorID,
          null,
          null,
          null,
          null,
          null,
          0,
          req.query.startingFunds ?? startingFundsDefault,
          req.query.smallBlind ?? smallBlindDefault,
          req.query.creatorID,
          0,
          req.query.creatorID,
        ]

        client
          .query(createGameQuery, values)
          .then((createRes) => {
            res.sendStatus(200)
          })
          .catch((err) => {
            console.error(err.stack)
            res.sendStatus(500)
          })
      })
      .catch((err) => {
        console.error(err)
        res.sendStatus(500)
      })
  }
)
