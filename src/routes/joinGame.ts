import { getClient } from '../utils/databaseConnection'
import { celebrate, Joi, Segments } from 'celebrate'
import sha256 from 'crypto-js/sha256'
import { type GameSettings } from '../app'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import express, { type Router } from 'express'
import { rateLimiter } from '../utils/rateLimiter'

const router: Router = express.Router()

router.get(
  '/joinGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
      nickname: Joi.string().required().max(20).label('nickname'),
      gameId: Joi.number().required().min(0).max(999999).label('gameId'),
    }),
  }),
  async (req, res) => {
    if (!(await verifyFCMToken(req.query.playerToken))) {
      return res.sendStatus(400)
    }

    const client = getClient()

    client
      .connect()
      .then(async () => {
        // Define queries
        const checkIfGameExistsQuery = `SELECT game_master FROM Games g 
            join Players p on g.game_id = p.game_id 
            WHERE g.game_id = $1 and g.game_round = 0
            group by g.game_id having count(p.token) < 8`
        const checkIfPlayerNotInGameQuery =
          'SELECT * FROM Players WHERE token=$1'
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

        // Check if player isn't already in the game
        const playerNotInGameResult = await client.query(
          checkIfPlayerNotInGameQuery,
          [req.query.playerToken]
        )
        if (playerNotInGameResult.rowCount !== 0) {
          return res.sendStatus(400)
        }

        // Check if game exists
        const checkIfGameExistResult = await client.query(
          checkIfGameExistsQuery,
          gameCheckValues
        )

        if (checkIfGameExistResult.rowCount === 0) {
          return res.sendStatus(401)
        }

        // Prepare info for new player
        const gameInfo: GameSettings = {
          smallBlind: 0,
          startingFunds: 0,
          players: [],
          gameMasterHash: sha256(
            checkIfGameExistResult.rows[0].game_master
          ).toString(),
        }
        await client
          .query(getGameInfoQuery, getGameInfoValues)
          .then((result) => {
            gameInfo.smallBlind = parseInt(result.rows[0].small_blind)
            gameInfo.startingFunds = parseInt(result.rows[0].starting_funds)
          })

        // Notify players about new player
        const playersInRoomResult = await client
          .query(getPlayersInRoomQuery, getPlayersInRoomValues)

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
        playersInRoomResult.rows.forEach(async (row) => {
          gameInfo.players.push({
            nickname: row.nickname,
            playerHash: sha256(row.token).toString(),
          })
          // Sending firebase message to all players except the one
          // who just joined.
          if (row.token !== req.query.playerToken) {
            message.token = row.token
            await sendFirebaseMessage(message)
          }
        })
        await client.query(createPlayerQuery, createPlayerValues)
        res.send(gameInfo)
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

export default router
