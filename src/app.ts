import express from 'express'
import { celebrate, Joi, isCelebrateError, Segments } from 'celebrate'
import { getClient } from './databaseConnection'

export const app = express()
export const port = 42069

const startingFundsDefault = 1000
const smallBlindDefault = 100
export interface playerInfo {
  nickname: string
  playerId: number
}
export interface gameSettings {
  smallBlind: number
  startingFunds: number
  players: playerInfo[]
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
    // todo add firebase validation

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
                res.send({
                  gameKey: result.rows[0].insert_with_random_key,
                  startingFunds:
                    req.query.startingFunds ?? startingFundsDefault,
                  smallBlind: req.query.smallBlind ?? smallBlindDefault,
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

app.get(
  '/joinGame',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      nickname: Joi.string().required().max(20).label('nickname'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'), // Range of ids is 0-999999
    }),
  }),
  (req, res) => {
    // todo add firebase validation

    const client = getClient()

    client
      .connect()
      .then(async () => {
        const checkIfGameExistsQuery =
          'SELECT game_master FROM Games WHERE game_id=$1'
        const gameCheckValues = [req.query.gameId]
        const createPlayerQuery =
          'INSERT INTO Players(token, nickname, turn, game_id, card1, card2, funds, bet) VALUES($1, $2, $3, $4, $5, $6, $7, $8)'
        const createPlayerValues = [
          req.query.playerToken,
          req.query.nickname,
          0,
          req.query.gameId,
          null,
          null,
          null,
          null,
        ]
        const getGameInfoQuery = 'SELECT * FROM Games WHERE game_id=$1'
        const getGameInfoValues = [req.query.gameId]
        const getPlayersInRoomQuery =
          'SELECT nickname FROM Players WHERE game_id=$1'
        const getPlayersInRoomValues = [req.query.gameId]

        await client
          .query(checkIfGameExistsQuery, gameCheckValues)
          .then(async (result) => {
            if (result.rowCount === 0) {
              // game does not exist
              return res.sendStatus(401)
            } else {
              // game exists
              await client
                .query(createPlayerQuery, createPlayerValues)
                .catch((err) => {
                  console.error(err.stack)
                  return res.sendStatus(500)
                })
              const gameInfo: gameSettings = {
                smallBlind: 0,
                startingFunds: 0,
                players: [],
              }
              await client
                .query(getGameInfoQuery, getGameInfoValues)
                .then((result) => {
                  gameInfo.smallBlind = parseInt(result.rows[0].small_blind)
                  gameInfo.startingFunds = parseInt(
                    result.rows[0].starting_funds
                  )
                })
                .catch((err) => {
                  console.error(err.stack)
                  return res.sendStatus(500)
                })
              await client
                .query(getPlayersInRoomQuery, getPlayersInRoomValues)
                .then((result) => {
                  result.rows.forEach((row) => {
                    gameInfo.players.push({
                      nickname: row.nickname,
                      playerId: 1,
                    })
                  })
                })
                .catch((err) => {
                  console.error(err.stack)
                  return res.sendStatus(500)
                })
              res.send(gameInfo)
            }
          })
      })
      .catch((err) => {
        console.log(err.stack)
        return res.sendStatus(500)
      })
      .finally(async () => {
        await client.end()
      })
  }
)
app.use(errorHandling)
