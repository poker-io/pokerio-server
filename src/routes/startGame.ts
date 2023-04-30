import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import { type StartingGameInfo, type InternalPlayerInfo } from '../app'
import { shuffleArray, fullCardDeck } from '../utils/randomise'
import sha256 from 'crypto-js/sha256'

import express, { type Router } from 'express'
const router: Router = express.Router()

router.get(
  '/startGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string()
        .required()
        .min(1)
        .max(250)
        .label('creatorToken'),
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
        // Define queries
        const getGameIdQuery = `SELECT game_id, starting_funds 
        FROM Games WHERE game_master=$1 AND current_player IS NULL`
        const getPlayersQuery =
          'SELECT nickname, token FROM Players WHERE game_id=$1'
        const updateGameStateQuery = `UPDATE Games SET current_player=$1, small_blind_who=$2, game_round=$3,
        current_table_value=$4,
        card1=$5, card2=$6, card3=$7, card4=$8, card5=$9 WHERE
        game_id=$10`
        const updatePlayerStateQuery =
          'UPDATE Players SET turn=$1, card1=$2, card2=$3, funds=$4 WHERE token=$5'

        // Check if the player is a master of not started game
        const getGameIdResult = await client.query(getGameIdQuery, [
          req.query.creatorToken,
        ])
        if (getGameIdResult.rowCount === 0) {
          return res.sendStatus(400)
        }
        const gameId = getGameIdResult.rows[0].game_id
        const startingFunds = getGameIdResult.rows[0].starting_funds

        const playersResult = await client.query(getPlayersQuery, [gameId])
        const playersCount = playersResult.rowCount
        if (playersCount < 2) {
          return res.sendStatus(400)
        }

        const playersInGame: InternalPlayerInfo[] = []
        for (let i = 0; i < playersCount; i++) {
          playersInGame.push({
            token: playersResult.rows[i].token,
            card1: '',
            card2: '',
          })
        }

        shuffleArray(playersInGame)
        const cardDeck = shuffleArray(fullCardDeck.slice())

        const gameInfo: StartingGameInfo = {
          players: [],
          cards: [],
        }
        for (let i = 0; i < playersCount; i++) {
          gameInfo.players.push({
            playerHash: sha256(playersInGame[i].token).toString(),
            turn: i + 1,
          })
          playersInGame[i].card1 = cardDeck.pop()
          playersInGame[i].card2 = cardDeck.pop()
        }

        for (let i = 0; i < 5; i++) {
          gameInfo.cards.push(cardDeck.pop())
        }

        await client.query(updateGameStateQuery, [
          playersInGame[0].token,
          playersInGame[0].token,
          1,
          0,
          ...gameInfo.cards,
          gameId,
        ])

        for (let i = 0; i < playersCount; i++) {
          await client.query(updatePlayerStateQuery, [
            gameInfo.players[i].turn,
            playersInGame[i].card1,
            playersInGame[i].card2,
            startingFunds,
            playersInGame[i].token,
          ])
        }

        const message = {
          data: {
            type: 'startGame',
            startedGameInfo: JSON.stringify(gameInfo),
            card1: '',
            card2: '',
          },
          token: '',
        }

        playersInGame.forEach(async (player) => {
          message.token = player.token
          message.data.card1 = player.card1
          message.data.card2 = player.card2
          await sendFirebaseMessage(message)
        })

        res.sendStatus(200)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

export default router
