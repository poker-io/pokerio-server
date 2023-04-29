import express from 'express'
import { isCelebrateError } from 'celebrate'

import kickPlayer from './routes/kickPlayer'
import joinGame from './routes/joinGame'
import createGame from './routes/createGame'
import leaveGame from './routes/leaveGame'
import { rateLimiter } from './utils/rateLimiter'

export const app = express()
export const port = 42069

export const startingFundsDefault = 1000
export const smallBlindDefault = 100
export interface playerInfo {
  nickname: string
  playerHash: string
}
export interface gameSettings {
  smallBlind: number
  startingFunds: number
  players: playerInfo[]
  gameMasterHash: string
}

export interface newGameInfo {
  gameKey: number
  startingFunds: number
  smallBlind: number
}

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

app.use(kickPlayer)

app.use(leaveGame)

app.use(errorHandling)
