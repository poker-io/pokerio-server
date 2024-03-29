import { runRequestWithClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import type {
  StartingGameInfo,
  FirebasePlayerInfoWIthCards,
  BasicPlayerInfo,
} from '../utils/types'
import { shuffleArray, fullCardDeck } from '../utils/randomise'
import sha256 from 'crypto-js/sha256'
import { type PoolClient } from 'pg'
import {
  getBigBlindToken,
  getPlayersInGame,
  getSmallBlindToken,
  getSmallBlindValue,
} from '../utils/commonRequest'

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

    await runRequestWithClient(res, async (client) => {
      const { gameId, startingFunds } = await getGameInfoIfNotStarted(
        creatorToken,
        client
      )
      if (gameId === null) {
        return res.sendStatus(402)
      }

      const players = await getPlayersInGame(gameId, client)

      if (players.length < 2) {
        return res.sendStatus(403)
      }

      const playersInGame = convertToInternalPlayerInfo(players)

      const cardDeck = fullCardDeck.slice()

      const gameInfo = createStartedGameInfo(playersInGame, cardDeck)

      await updatePlayersStates(playersInGame, startingFunds, gameInfo, client)

      const smallBlind = await getSmallBlindToken(
        gameId,
        players.length,
        client
      )
      await updateGameState(
        playersInGame[0].token,
        gameId,
        gameInfo,
        client,
        smallBlind,
        players.length
      )

      await notifyPlayers(playersInGame, gameInfo)

      res.sendStatus(200)
    })
  }
)

function convertToInternalPlayerInfo(players: BasicPlayerInfo[]) {
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
  client: PoolClient
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

async function prepareBlinds(
  client: PoolClient,
  smallBlind: string,
  bigBlind,
  smallBlindValue: string
) {
  const query = 'UPDATE Players SET funds=funds-$1, bet=$2 WHERE token=$3'
  const smallBlindQueryValues = [
    smallBlindValue,
    parseInt(smallBlindValue),
    smallBlind,
  ]
  const bigBlindQueryValues = [
    +smallBlindValue * 2,
    parseInt(smallBlindValue) * 2,
    bigBlind,
  ]
  await client.query(query, smallBlindQueryValues)
  await client.query(query, bigBlindQueryValues)
}

async function updateGameState(
  firstPlayerToken: string,
  gameId: string,
  gameInfo: StartingGameInfo,
  client: PoolClient,
  smallBlind: string,
  playerSize: number
) {
  const smallBlindValue = await getSmallBlindValue(gameId, client)
  const query = `UPDATE Games SET current_player=$1, small_blind_who=$2, 
    game_round=$3, current_table_value=$4, 
    card1=$5, card2=$6, card3=$7, card4=$8, card5=$9 WHERE game_id=$10`

  const values = [
    firstPlayerToken,
    smallBlind,
    1,
    +smallBlindValue * 3,
    ...gameInfo.cards,
    gameId,
  ]
  await client.query(query, values)
  await prepareBlinds(
    client,
    smallBlind,
    await getBigBlindToken(gameId, playerSize, client),
    smallBlindValue
  )
}

async function updatePlayersStates(
  players: FirebasePlayerInfoWIthCards[],
  startingFunds: string,
  gameInfo: StartingGameInfo,
  client: PoolClient
) {
  const query =
    'UPDATE Players SET turn=$1, card1=$2, card2=$3, funds=$4, bet=0 WHERE token=$5'
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
      players: JSON.stringify(gameInfo.players),
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
