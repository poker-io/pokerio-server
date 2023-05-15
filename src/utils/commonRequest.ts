import { type Client } from 'pg'

export async function createPlayer(
  playerToken: string,
  nickname: string,
  gameId: string | null,
  client: Client
) {
  const createPlayerQuery = `INSERT INTO Players(token, nickname, turn, 
            game_id, card1, card2, funds, bet) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
  const createPlayerValues = [
    playerToken,
    nickname,
    0,
    gameId,
    null,
    null,
    null,
    null,
  ]
  await client.query(createPlayerQuery, createPlayerValues)
}

export async function playerInGame(playerToken: string, client: Client) {
  const checkIfPlayerInGameQuery = 'SELECT * FROM Players WHERE token=$1'
  const playerInGameValues = [playerToken]
  return (
    (await client.query(checkIfPlayerInGameQuery, playerInGameValues))
      .rowCount !== 0
  )
}

export async function deletePlayer(playerToken: string, client: Client) {
  const deletePlayerQuery = 'DELETE FROM Players WHERE token=$1'
  const deletePlayerValues = [playerToken]
  await client.query(deletePlayerQuery, deletePlayerValues)
}
