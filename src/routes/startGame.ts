import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { verifyFCMToken } from '../utils/firebase'
import { type PlayerDuringGame, type PlayerInfo } from '../app'
import { shuffleArray } from '../utils/randomise'
import sha256 from 'crypto-js/sha256'

import express, { type Router } from 'express'
// import { refreshToken } from 'firebase-admin/app'
const router: Router = express.Router()

router.get(
  '/startGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      creatorToken: Joi.string().required().min(1).max(250).label('creatorToken'),
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
        const getGameIdQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
        const getPlayersQuery =
          'SELECT nickname, token FROM Players WHERE game_id=$1'
        // const updateGameStateQuery =
        // 'UPDATE Games SET current_player=$1 small_blind_who=$2 WHERE game_id=$2'
        // const updatePlayerStateQuery =
        // 'UPDATE Players SET turn=$1 WHERE token=$2'

        // Check if the player is a master of any game
        const getGameIdResult = await client.query(getGameIdQuery, [
          req.query.creatorToken,
        ])
        if (getGameIdResult.rowCount === 0) {
          return res.sendStatus(400)
        }
        const gameId = getGameIdResult.rows[0].game_id

        const playersResult = await client.query(getPlayersQuery, [gameId])
        const playersCount = playersResult.rowCount
        if (playersCount < 2) {
          return res.sendStatus(400)
        }
        let playersInGame: PlayerInfo[] = []
        const onePlayerInfo: PlayerInfo = {
          nickname: '',
          playerHash: ''
        }
        const onePlayerDuringGame: PlayerDuringGame = {
          info: onePlayerInfo,
          turn: 0,
          card1: '',
          card2: ''
        }
        // const cardDeck = fullCardDeck.slice()

        for (let i = 0; i < playersCount; i++) {
          onePlayerInfo.nickname = playersResult.rows[i].nickname
          onePlayerInfo.playerHash = sha256(playersResult.rows[i].token).toString()
          playersInGame.push(onePlayerInfo)
        }
        playersInGame = shuffleArray(playersInGame)
        for (let i = 0; i < playersCount; i++) {
          onePlayerDuringGame.info = playersInGame[i]
          onePlayerDuringGame.turn = i + 1
        }
      })
      .finally(async () => {
        await client.end()
      })
  }
)

export default router
