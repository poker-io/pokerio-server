import { type Client } from 'pg'
import type { FirebasePlayerInfo } from './types'

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
  const query = 'UPDATE Players SET last_action=$1 WHERE playerToken=$2'
  await client.query(query, [state, playerToken])
}

export async function getPlayerState(playerToken: string, client: Client) {
  const query = 'SELECT last_action FROM Players WHERE player_token=$1'
  await client.query(query, [playerToken])
}

export async function setNewTurn(
  oldPlayerToken: string,
  gameId: string,
  client: Client
) {
  const getOldPlayerTurn = 'SELECT turn FROM Players WHERE token=$1'
  const getPlayerCount = 'SELECT COUNT(token) FROM Players WHERE game_id=$1'
  const getNewCurrentPlayer =
    'SELECT token FROM Player WHERE game_id=$1 AND turn=$2'
  const setNewCurrentPlayer =
    'UPDATE Games SET current_player=$1 WHERE game_id=$2'

  const playerCount = await (
    await client.query(getPlayerCount, [gameId])
  ).rows[0].token
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
}

export async function getPlayersInGame(
  gameId: string,
  client: Client
): Promise<FirebasePlayerInfo[]> {
  const query = 'SELECT token, nickname FROM Players WHERE game_id=$1'
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
