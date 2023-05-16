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

export async function isPlayerInGame(
  playerToken: string,
  client: Client
): Promise<boolean> {
  const query = 'SELECT * FROM Players WHERE token=$1'
  return (await client.query(query, [playerToken])).rowCount !== 0
}

export async function deletePlayer(playerToken: string, client: Client) {
  const query = 'DELETE FROM Players WHERE token=$1'
  await client.query(query, [playerToken])
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
