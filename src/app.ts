import express from 'express'
import { celebrate, Joi } from 'celebrate'
import { getClient } from './databaseConnection'

export const app = express()
export const port = 42069

const startingFundsDefault = 1000
const smallBlindDefault = 100

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
    let createGameQuery = 'SELECT * FROM insert_with_random_key('
    const selectQuery = 'SELECT id FROM Players WHERE id = '.concat(
      req.query.creatorID?.toString() ?? ''
    )
    let creatorExists: boolean = false

    client
      .query(selectQuery)
      .then((selectRes) => {
        creatorExists = Boolean(selectRes.rows.length)

        if (!creatorExists) {
          res.sendStatus(400)
        }

        console.log(selectRes.rows)
        const values = [
          req.query.creatorID,
          'null',
          'null',
          'null',
          'null',
          'null',
          0,
          req.query.startingFunds ?? startingFundsDefault,
          req.query.smallBlind ?? smallBlindDefault,
          req.query.creatorID,
          0,
          req.query.creatorID,
        ]

        createGameQuery = createGameQuery.concat(values.toString()).concat(')')
        console.log(createGameQuery)

        client
          .query(createGameQuery)
          .then(() => {
            res.sendStatus(200)
          })
          .catch((err) => {
            console.error(err.stack)
            res.sendStatus(500)
          })
      })
      .catch((err) => {
        console.error(err.stack)
        res.sendStatus(500)
      })
  }
)
