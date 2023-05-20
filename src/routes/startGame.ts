import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import type {
  StartingGameInfo,
  FirebasePlayerInfoWIthCards,
  FirebasePlayerInfo,
} from '../utils/types'
import { shuffleArray, fullCardDeck } from '../utils/randomise'
import sha256 from 'crypto-js/sha256'
import { type Client } from 'pg'
import { getPlayersInGame, getSmallBlind } from '../utils/commonRequest'

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
    const creatorToken = req.query.creatorToken as string

    if (!(await verifyFCMToken(creatorToken))) {
      return res.sendStatus(401)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        const { gameId, startingFunds } = await getGameInfoIfNotStarted(
          creatorToken,
          client
        )
        if (gameId === null) {
          return res.sendStatus(400)
        }

        const players = await getPlayersInGame(gameId, client)

        if (players.length < 2) {
          return res.sendStatus(402)
        }

        const playersInGame = convertToInternalPlayerInfo(players)

        const cardDeck = fullCardDeck.slice()

        const gameInfo = createStartedGameInfo(playersInGame, cardDeck)

        await updatePlyersStates(playersInGame, startingFunds, gameInfo, client)

        const smallBlind = await getSmallBlind(gameId, players.length, client)
        await updateGameState(
          playersInGame[0].token,
          gameId,
          gameInfo,
          client,
          smallBlind
        )

        await notifyPlayers(playersInGame, gameInfo)

        res.sendStatus(200)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

function convertToInternalPlayerInfo(players: FirebasePlayerInfo[]) {
  const playersInGame: FirebasePlayerInfoWIthCards[] = []
  players.forEach((player) => {
    playersInGame.push({
      token: player.token,
      nickname: player.nickname,
      card1: '',
      card2: '',
    })
  })
  return playersInGame
}

async function getGameInfoIfNotStarted(
  gameMaster: string,
  client: Client
): Promise<{ gameId: string | null; startingFunds: string }> {
  const gameInfo = { gameId: null, startingFunds: '' }
  const query =
    'SELECT game_id, starting_funds FROM Games WHERE game_master=$1 AND current_player IS NULL'
  const result = await client.query(query, [gameMaster])
  if (result.rowCount !== 0) {
    gameInfo.gameId = result.rows[0].game_id
    gameInfo.startingFunds = result.rows[0].starting_funds
  }
  return gameInfo
}

function createStartedGameInfo(
  players: FirebasePlayerInfoWIthCards[],
  cardDeck: string[]
) {
  const gameInfo: StartingGameInfo = {
    players: [],
    cards: [],
  }
  shuffleArray(players)
  shuffleArray(cardDeck)
  for (let i = 0; i < players.length; i++) {
    gameInfo.players.push({
      playerHash: sha256(players[i].token).toString(),
      nickname: players[i].nickname,
      turn: i,
    })
    players[i].card1 = cardDeck.pop() as string
    players[i].card2 = cardDeck.pop() as string
  }

  for (let i = 0; i < 5; i++) {
    gameInfo.cards.push(cardDeck.pop() as string)
  }
  return gameInfo
}

async function updateGameState(
  firstPlayerToken: string,
  gameId: string,
  gameInfo: StartingGameInfo,
  client: Client,
  smallBlind: string
) {
  const query = `UPDATE Games SET current_player=$1, small_blind_who=$2, 
    game_round=$3, current_table_value=$4, 
    card1=$5, card2=$6, card3=$7, card4=$8, card5=$9 WHERE game_id=$10`

  const values = [firstPlayerToken, smallBlind, 1, 0, ...gameInfo.cards, gameId]
  await client.query(query, values)
}

async function updatePlyersStates(
  players: FirebasePlayerInfoWIthCards[],
  startingFunds: string,
  gameInfo: StartingGameInfo,
  client: Client
) {
  const query =
    'UPDATE Players SET turn=$1, card1=$2, card2=$3, funds=$4 WHERE token=$5'
  const values = [0, 'card1', 'card2', startingFunds, 'token']
  for (let i = 0; i < players.length; i++) {
    values[0] = gameInfo.players[i].turn
    values[1] = players[i].card1
    values[2] = players[i].card2
    values[4] = players[i].token
    await client.query(query, values)
  }
}

async function notifyPlayers(
  players: FirebasePlayerInfoWIthCards[],
  gameInfo: StartingGameInfo
) {
  const message = {
    data: {
      type: 'startGame',
      startedGameInfo: JSON.stringify(gameInfo),
      card1: '',
      card2: '',
    },
    token: '',
  }

  players.forEach(async (player) => {
    message.token = player.token
    message.data.card1 = player.card1
    message.data.card2 = player.card2
    await sendFirebaseMessage(message)
  })
}

export default router
