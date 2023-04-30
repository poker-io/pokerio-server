import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'
import { type NewGameInfo } from '../app'

test('Leave game, wrong args', (doneLeave) => {
  const gameMasterToken = 'TESTLEAVE_INCORRECT'

  // No game with given player
  request(app)
    .get(`/leaveGame?playerToken=${gameMasterToken}`)
    .expect(400)
    .end(doneLeave)
})

test('Leave game, correct arguments', async () => {
  const gameMasterToken = 'TESTLEAVE'
  const gameMasterNick = 'NICKLEAVE'
  const playerToken = 'TESTLEAVE2'
  const playerNick = 'NICKLEAVE2'
  const player2Token = 'TESTLEAVE3'
  const player2Nick = 'NICKLEAVE3'

  const getPlayersQuery = 'SELECT token FROM Players WHERE game_id=$1'
  const getGameMasterQuery = 'SELECT game_master FROM Games WHERE game_id=$1'
  const getGameQuery = 'SELECT * FROM Games WHERE game_id=$1'

  const client = getClient()
  await client.connect()
  const res = await request(app)
    .get(
      `/createGame?creatorToken=${gameMasterToken}&nickname=${gameMasterNick}`
    )
    .expect(200)

  const key = (res.body as NewGameInfo).gameKey
  await request(app)
    .get(
      `/joinGame?playerToken=${playerToken}&nickname=${playerNick}&gameId=${key}`
    )
    .expect(200)
  await request(app)
    .get(
      `/joinGame?playerToken=${player2Token}&nickname=${player2Nick}&gameId=${key}`
    )
    .expect(200)

  await request(app).get(`/leaveGame?playerToken=${playerToken}`).expect(200)

  const playersResult1 = await client.query(getPlayersQuery, [key])
  const gameMasterResult1 = await client.query(getGameMasterQuery, [key])

  expect(gameMasterResult1.rowCount).toEqual(1)
  expect(gameMasterResult1.rows[0].game_master).toEqual(gameMasterToken)
  expect(playersResult1.rowCount).toEqual(2)

  await request(app)
    .get(`/leaveGame?playerToken=${gameMasterToken}`)
    .expect(200)

  const playersResult2 = await client.query(getPlayersQuery, [key])
  const gameMasterResult2 = await client.query(getGameMasterQuery, [key])

  expect(gameMasterResult2.rowCount).toEqual(1)
  expect(gameMasterResult2.rows[0].game_master).toEqual(player2Token)
  expect(playersResult2.rowCount).toEqual(1)
  expect(playersResult2.rows[0].token).toEqual(player2Token)

  await request(app).get(`/leaveGame?playerToken=${player2Token}`).expect(200)

  const playersResult3 = await client.query(getPlayersQuery, [key])
  const gameResult = await client.query(getGameQuery, [key])

  expect(playersResult3.rowCount).toEqual(0)
  expect(gameResult.rowCount).toEqual(0)

  await client.end()
}, 20000)
