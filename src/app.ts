import express from 'express'
import { celebrate, Joi, isCelebrateError, Segments } from 'celebrate'
import { getClient } from './databaseConnection'
// import getAuth from 'firebase-auth'

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
  (req, res) => {
    // Does not work for some reason
    // getAuth()
    //  .verifyIdToken(req.query.creatorToken)
    //  .catch((error) => {
    //    console.log(error.stack)
    //
    //    return res.sendStatus(400)
    //  })

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // todo add firebase validation

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

        await client
          .query(createPlayerQuery, createPlayerValues)
          .catch(async (err) => {
            console.error(err.stack)
            await client.end()
            return res.sendStatus(500)
          })

        await client
          .query(createGameQuery, values)
          .then(async (result) => {
            await client
              .query('UPDATE Players SET game_id=$1 WHERE token=$2', [
                result.rows[0].insert_with_random_key,
                req.query.creatorToken,
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
          .catch((err) => {
            console.error(err.stack)
            return res.sendStatus(500)
          })

        await client.end()
      })
      .catch(async (err) => {
        console.log(err.stack)
        await client.end()
        return res.sendStatus(500)
      })
  }
)

app.use(errorHandling)
