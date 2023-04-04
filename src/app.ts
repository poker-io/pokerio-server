import express from 'express'
import { celebrate, Joi, isCelebrateError, Segments } from 'celebrate'
import { getClient } from './databaseConnection'
import sha256 from 'crypto-js/sha256'
import { getMessaging } from 'firebase-admin/messaging'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { rateLimit } from 'express-rate-limit'

const serviceAccount = JSON.parse(
  readFileSync('./src/serviceAccount.json', 'utf-8')
)

admin.initializeApp({
  credential: admin.credential.cert({
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    projectId: serviceAccount.project_id,
  }),
})

const verifyFCMToken = async (fcmToken) => {
  if (process.env.JEST_WORKER_ID !== undefined) {
    // We don't want to verify tokens when testing
    return true
  } else {
    let sentSuccessfully = true
    await admin
      .messaging()
      .send(
        {
          token: fcmToken,
        },
        true
      )
      .catch(() => {
        sentSuccessfully = false
      })
    return sentSuccessfully
  }
}

export const app = express()
export const port = 42069

const startingFundsDefault = 1000
const smallBlindDefault = 100
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

interface newGameInfo {
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

app.get(
  '/joinGame',
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      nickname: Joi.string().required().max(20).label('nickname'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'),
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
        const checkIfGameExistsQuery =
          'SELECT game_master FROM Games g join Players p on g.game_id = p.game_id WHERE g.game_id = $1 group by g.game_id having count(p.token) < 8'
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
          'SELECT nickname, token FROM Players WHERE game_id=$1'
        const getPlayersInRoomValues = [req.query.gameId]
        await client
          .query(checkIfGameExistsQuery, gameCheckValues)
          .then(async (result) => {
            if (result.rowCount === 0) {
              return res.sendStatus(401)
            } else {
              const gameInfo: gameSettings = {
                smallBlind: 0,
                startingFunds: 0,
                players: [],
                gameMasterHash: sha256(result.rows[0].game_master).toString(),
              }
              await client.query(createPlayerQuery, createPlayerValues)
              await client
                .query(getGameInfoQuery, getGameInfoValues)
                .then((result) => {
                  gameInfo.smallBlind = parseInt(result.rows[0].small_blind)
                  gameInfo.startingFunds = parseInt(
                    result.rows[0].starting_funds
                  )
                })
              await client
                .query(getPlayersInRoomQuery, getPlayersInRoomValues)
                .then((result) => {
                  const message = {
                    data: {
                      type: 'playerJoined',
                      // We know that the nickname will be defined
                      // because we checked it with celebrate.
                      nickname: req.query.nickname as string,
                      playerHash: sha256(req.query.playerToken).toString(),
                    },
                    token: '',
                  }
                  result.rows.forEach(async (row) => {
                    gameInfo.players.push({
                      nickname: row.nickname,
                      playerHash: sha256(row.token).toString(),
                    })
                    if (
                      row.token !== req.query.playerToken &&
                      process.env.JEST_WORKER_ID === undefined
                    ) {
                      // Again, we don't want to send messages when testing.
                      // Sending firebase message to all players except the one who just joined.
                      message.token = row.token
                      await getMessaging()
                        .send(message)
                        .then((response) => {
                          console.log('Successfully sent message:', response)
                        })
                        .catch((error) => {
                          console.log('Error sending message:', error)
                        })
                    }
                  })
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
