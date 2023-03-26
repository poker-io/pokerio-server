import express from 'express'
import { celebrate, Joi, isCelebrateError, Segments } from 'celebrate'
import { getClient } from './databaseConnection'

export const app = express()
export const port = 42069

const startingFundsDefault = 1000
const smallBlindDefault = 100

const errorHandling = (error, req, res, next) => {
  if (isCelebrateError(error)) {
    return res.status(400).send({
      statusCode: 400,
      message: error.details.get('query')?.details[0].message,
    })
  }

  return next(error)
}

app.get('/test', (req, res) => {
  res.send('Hello from typescript express!')
})

app.get(
  '/createGame',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorID: Joi.number().required().min(1).label('creatorID'),
      startingFunds: Joi.number().min(1).label('Starting Funds'),
      smallBlind: Joi.number().min(1).label('Small Blind'),
    }),
  }),
  async (req, res) => {
    const client = getClient()
    await client.connect()
    let createGameQuery = 'SELECT * FROM insert_with_random_key('
    const selectQuery = 'SELECT id FROM Players WHERE id = '.concat(
      req.query.creatorID?.toString() ?? ''
    )
    let creatorExists: boolean = false

    await client
      .query(selectQuery)
      .then(async (selectRes) => {
        creatorExists = Boolean(selectRes.rows.length)

        if (!creatorExists) {
          await client.end()
          return res.sendStatus(400)
        }

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

        await client
          .query(createGameQuery)
          .then(async (result) => {
            await client
              .query('UPDATE Players SET game_id=$1 WHERE id=$2', [
                result.rows[0].insert_with_random_key,
                req.query.creatorID,
              ])
              .then(() => {
                return res.sendStatus(200)
              })
              .catch((err) => {
                console.error(err.stack)
                return res.sendStatus(500)
              })
          })
          .catch((err) => {
            console.error(err.stack)
            return res.sendStatus(500)
          })
      })
      .catch((err) => {
        console.error(err.stack)
        return res.sendStatus(500)
      })

    await client.end()
  }
)

app.use(errorHandling)
