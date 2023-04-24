import express from 'express'
import { isCelebrateError } from 'celebrate'

import { rateLimit } from 'express-rate-limit'
import joinGame from './joinGame'
import createGame from './createGame'

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

const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
})
app.use(rateLimiter)

app.use('', joinGame)

app.use('', createGame)

app.use(errorHandling)
