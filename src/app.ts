import express from 'express'
import { celebrate, Joi } from 'celebrate'
import { getClient } from './databaseConnection'

export const app = express()
export const port = 42069

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
  async (req, res) => {
    const client = getClient()
    await client.connect()
    const selectQuery = 'SELECT id FROM Players WHERE id = '.concat(
      req.query.creatorID?.toString() ?? ''
    )
    let creatorExists: boolean = false

    try {
      const queryResult = await client.query(selectQuery)
      creatorExists = Boolean(queryResult.rows.length)
    } catch (err) {
      console.error(err)
    }
    console.log(creatorExists.valueOf())

    res.send('Got create')
  }
)
