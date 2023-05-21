import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'
import type { NewGameInfo } from '../utils/types'
import { getPlayersInGame } from '../utils/commonRequest'

test('Check, wrong args', async () => {
  const gameMasterToken = 'CHECKTEST_INCORRECT_GM'
  const gameMasterNick = 'CHECK_INC_GM_NICK'
  const playerToken = 'CHECKTEST_INCORRECT_P1'
  const playerNick = 'CHECK_INC_P1_NICK'
  const player2Token = 'CHECKTEST_INCORRECT_P2'
  const player2Nick = 'CHECK_INC_P2_NICK'
  const wrongToken = 'TESTCHECK_INCORRECT'
  const wrongGameId = 'WRONG_ID'
  request(app).get(`/check?playerToken=${wrongToken}`).expect(400)

  request(app)
    .get(`/check?playerToken=${wrongToken}&gameId=${wrongGameId}`)
    .expect(400)

  const client = getClient()
  await client.connect()

  const res = await request(app)
    .get(
      `/createGame?creatorToken=${gameMasterToken}&nickname=${gameMasterNick}`
    )
    .expect(200)

  const key = (res.body as NewGameInfo).gameId
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

  await request(app)
    .get(`/startGame?creatorToken=${gameMasterToken}`)
    .expect(200)

  const gameId = key.toString()
  getPlayersInGame(gameId, client)
    .then(async (players) => {
      await request(app)
        .get(`/check?playerToken=${players[1].token}&gameId=${gameId}`)
        .expect(402)
      await request(app)
        .get(`/check?playerToken=${players[0].token}&gameId=${gameId}`)
        .expect(403)
    })
    .finally(async () => {
      await client.end()
    })
}, 20000)

test('Check, correct args', async () => {
  const gameMasterToken = 'CHECKTEST_GM'
  const gameMasterNick = 'CHECK_GM_NICK'
  const playerToken = 'CHECKTEST_P1'
  const playerNick = 'CHECK_P1_NICK'
  const player2Token = 'CHECKTEST_P2'
  const player2Nick = 'CHECK_P2_NICK'
  const client = getClient()
  await client.connect()

  const res = await request(app)
    .get(
      `/createGame?creatorToken=${gameMasterToken}&nickname=${gameMasterNick}`
    )
    .expect(200)

  const key = (res.body as NewGameInfo).gameId
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

  await request(app)
    .get(`/startGame?creatorToken=${gameMasterToken}`)
    .expect(200)

  const gameId = key.toString()
  getPlayersInGame(gameId, client)
    .then(async (players) => {
      await client.query('UPDATE Players SET bet=0 WHERE game_id=$1', [gameId])
      await request(app)
        .get(`/check?playerToken=${players[0].token}&gameId=${gameId}`)
        .expect(200)
    })
    .finally(async () => {
      await client.end()
    })
}, 20000)
