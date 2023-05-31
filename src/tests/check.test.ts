import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import type { NewGameInfo } from '../utils/types'
import { getPlayersInGame } from '../utils/commonRequest'
import './testSuiteTeardown'

test('Check, wrong args', async () => {
  const gameMasterToken = 'CHECKTEST_INC_GM'
  const gameMasterNick = 'CHECK_INC_GM_NICK'
  const playerToken = 'CHECKTEST_INC_P1'
  const playerNick = 'CHECK_INC_P1_NICK'
  const player2Token = 'CHECKTEST_INC_P2'
  const player2Nick = 'CHECK_INC_P2_NICK'
  const wrongToken = 'TESTCHECK_INC'
  const wrongGameId = 'WRONG_ID'
  const correctId = '1'

  await runRequestWithClient(undefined, async (client) => {
    await request(app).get(`/actionCheck?playerToken=${wrongToken}`).expect(400)

    await request(app)
      .get(`/actionCheck?playerToken=${wrongToken}&gameId=${wrongGameId}`)
      .expect(400)

    await request(app)
      .get(`/actionCheck?playerToken=${wrongToken}&gameId=${correctId}`)
      .expect(402)

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
    const players = await getPlayersInGame(gameId, client)
    await request(app)
      .get(`/actionCheck?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(403)
    await request(app)
      .get(`/actionCheck?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(404)
  })
}, 20000)

test('Check, correct args', async () => {
  const gameMasterToken = 'CHECKTEST_GM'
  const gameMasterNick = 'CHECK_GM_NICK'
  const playerToken = 'CHECKTEST_P1'
  const playerNick = 'CHECK_P1_NICK'
  const player2Token = 'CHECKTEST_P2'
  const player2Nick = 'CHECK_P2_NICK'

  await runRequestWithClient(undefined, async (client) => {
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
    const players = await getPlayersInGame(gameId, client)
    await client.query('UPDATE Players SET bet=0 WHERE game_id=$1', [gameId])
    await request(app)
      .get(`/actionCheck?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)
  })
}, 20000)
