import express from 'express'
import { isCelebrateError } from 'celebrate'

import kickPlayer from './routes/kickPlayer'
import joinGame from './routes/joinGame'
import createGame from './routes/createGame'
import modifyGame from './routes/modifyGame'
import leaveGame from './routes/leaveGame'
import startGame from './routes/startGame'
import fold from './routes/gameplay/fold'
import { rateLimiter } from './utils/rateLimiter'

export const app = express()
export const port = 42069

const errorHandling = (error, req, res, next) => {
  if (isCelebrateError(error)) {
    return res.status(400).send({
      statusCode: 400,
      message: error.details.get('query')?.details[0].message,
    })
  }

  return next(error)
}

app.get('/status', rateLimiter, (req, res) => {
  res.send('OK')
})

app.use(joinGame)

app.use(createGame)

app.use(modifyGame)

app.use(kickPlayer)

app.use(leaveGame)

app.use(startGame)

app.use(fold)

app.use(errorHandling)
