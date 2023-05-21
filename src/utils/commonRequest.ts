import { type Client } from 'pg'
import {
  type FirebasePlayerInfo,
  PlayerState,
  type FirebasePlayerInfoWIthCards,
} from './types'
import { Hand } from 'pokersolver'
import { convertCardName } from './randomise'

export const STARTING_FUNDS_DEFAULT = 1000
export const SMALL_BLIND_DEFAULT = 100
export const MAX_PLAYERS = 8
export const TURN_DEFAULT = -1

export async function createPlayer(
  playerToken: string,
  nickname: string,
  gameId: string | null,
  client: Client
) {
  const query = `INSERT INTO Players(token, nickname, turn, 
            game_id, card1, card2, funds, bet) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
  const values = [playerToken, nickname, 0, gameId, null, null, null, null]
  await client.query(query, values)
}

export async function isPlayerInAnyGame(
  playerToken: string,
  client: Client
): Promise<boolean> {
  const query = 'SELECT 1 FROM Players WHERE token=$1'
  return (await client.query(query, [playerToken])).rowCount !== 0
}

export async function isPlayerInGame(
  playerToken: string,
  gameId: string,
  client: Client
): Promise<boolean> {
  const query = 'SELECT 1 FROM Players WHERE token=$1 AND game_id=$2'
  return (await client.query(query, [playerToken, gameId])).rowCount !== 0
}

export async function isPlayersTurn(
  playerToken: string,
  gameId: string,
  client: Client
): Promise<boolean> {
  const query = 'SELECT 1 FROM Games WHERE game_id=$1 AND current_player=$2'
  return (await client.query(query, [gameId, playerToken])).rowCount !== 0
}

export async function deletePlayer(playerToken: string, client: Client) {
  const query = 'DELETE FROM Players WHERE token=$1'
  await client.query(query, [playerToken])
}

export async function setPlayerState(
  playerToken: string,
  client: Client,
  state: string
) {
  const query = 'UPDATE Players SET last_action=$1 WHERE token=$2'
  await client.query(query, [state, playerToken])
}

export async function getPlayerState(playerToken: string, client: Client) {
  const query = 'SELECT last_action FROM Players WHERE player_token=$1'
  await client.query(query, [playerToken])
}

export async function setNewCurrentPlayer(
  oldPlayerToken: string,
  gameId: string,
  client: Client
) {
  const getOldPlayerTurn = 'SELECT turn FROM Players WHERE token=$1'
  const getPlayerCount =
    'SELECT COUNT(*) as player_count FROM Players WHERE game_id=$1'
  const getNewCurrentPlayer =
    'SELECT token FROM Players WHERE game_id=$1 AND turn=$2'
  const setNewCurrentPlayer =
    'UPDATE Games SET current_player=$1 WHERE game_id=$2'

  const playerCount = await (
    await client.query(getPlayerCount, [gameId])
  ).rows[0].player_count
  const newTurn =
    (((await (
      await client.query(getOldPlayerTurn, [oldPlayerToken])
    ).rows[0].turn) as number) +
      1) %
    playerCount
  const newPlayer = await (
    await client.query(getNewCurrentPlayer, [gameId, newTurn])
  ).rows[0].token
  await client.query(setNewCurrentPlayer, [newPlayer, gameId])

  return newPlayer
}

export async function changeGameRoundIfNeeded(
  gameId: string,
  currentPlayerToken: string,
  client: Client
): Promise<boolean> {
  // The next round commences only if there is one active player OR when current player was the last raiser
  const shouldProceedNextRound = `SELECT 1 FROM Players A WHERE 
    (A.token=$1 AND A.last_action=$2 AND 1 = 
        (SELECT COUNT(*) FROM Players B WHERE B.last_action=$2)) OR 
            (SELECT COUNT(*) FROM Players C WHERE (C.last_action=$3 
            OR (C.bet=0 AND C.funds=0))) = $4`
  const playerCount = (await getPlayersInGame(gameId, client)).length
  const updateGameRound =
    'UPDATE Games SET game_round=game_round + 1 WHERE game_id=$1'
  const setFirstPlayer =
    'UPDATE Games SET current_player=(SELECT token FROM Players WHERE turn=0 AND game_id=$1) WHERE game_id=$1'
  if (
    (
      await client.query(shouldProceedNextRound, [
        currentPlayerToken,
        PlayerState.Raised,
        PlayerState.Folded,
        playerCount - 1,
      ])
    ).rowCount !== 0
  ) {
    await client.query(updateGameRound, [gameId])
    await client.query(setFirstPlayer, [gameId])
    // todo count cards and set winners
    return true
  } else {
    return false
  }
}

export async function getPlayersInGame(
  gameId: string,
  client: Client
): Promise<FirebasePlayerInfo[]> {
  const query =
    'SELECT token, nickname FROM Players WHERE game_id=$1 ORDER BY turn ASC'
  return (await client.query(query, [gameId])).rows
}

export async function getGameIdAndStatus(
  gameMaster: string,
  client: Client
): Promise<{ gameId: string | null; started: boolean }> {
  const query = 'SELECT game_id, current_player FROM Games WHERE game_master=$1'
  const result = await client.query(query, [gameMaster])
  let gameId = null
  let currentPlayer = null
  if (result.rowCount !== 0) {
    gameId = result.rows[0].game_id
    currentPlayer = result.rows[0].current_player
  }
  return { gameId, started: currentPlayer !== null }
}

export async function getSmallBlind(
  gameId: string,
  playerSize: number,
  client: Client
): Promise<string> {
  const getSmallBlind = 'SELECT token FROM Players WHERE game_id=$1 AND turn=$2'
  return (await client.query(getSmallBlind, [gameId, playerSize - 2])).rows[0]
    .token
}

export async function getBigBlind(
  gameId: string,
  playerSize: number,
  client: Client
): Promise<string> {
  const getBigBlind = 'SELECT token FROM Players WHERE game_id=$1 AND turn=$2'
  return (await client.query(getBigBlind, [gameId, playerSize - 1])).rows[0]
    .token
}

export async function getSmallBlindValue(
  gameId: string,
  client: Client
): Promise<string> {
  const query = 'SELECT small_blind FROM Games WHERE game_id=$1'
  return (await client.query(query, [gameId])).rows[0].small_blind
}

export async function getRemainingPlayersCards(
  gameId: string,
  client: Client
): Promise<FirebasePlayerInfoWIthCards[]> {
  const query =
    'SELECT token, nickname, card1, card2 FROM Players WHERE game_id=$1 and last_action <> $2'
  const values = [gameId, PlayerState.Folded]
  return (await client.query(query, values)).rows
}

export async function getGameCards(gameId: string, client: Client) {
  const query =
    'SELECT card1, card2, card3, card4, card5 FROM games WHERE game_id=$1'
  const queryResult = await client.query(query, [gameId])
  const cards: string[] = []
  Object.entries(queryResult.rows[0]).forEach(([key, value]) => {
    cards.push(convertCardName(value as string))
  })
  return cards
}

export async function calculateWinner(gameId: string, client: Client) {
  const playersWithCards = await getRemainingPlayersCards(gameId, client)
  const gameCards = await getGameCards(gameId, client)
  const playersHands: any[] = []

  playersWithCards.forEach((player) => {
    playersHands.push(
      Hand.solve([
        convertCardName(player.card1),
        convertCardName(player.card2),
        ...gameCards,
      ])
    )
  })

  const solution: any[] = Hand.winners(playersHands)
  const winners: any[] = []
  for (let i = 0; i < playersHands.length; i++) {
    if (solution.includes(playersHands[i])) {
      winners.push(playersWithCards[i].token)
    }
  }
  return winners
}
