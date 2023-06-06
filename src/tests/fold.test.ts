import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import { type NewGameInfo } from '../utils/types'
import { getPlayersInGame } from '../utils/commonRequest'
import './testSuiteTeardown'

test('Fold, wrong args', (done) => {
  const wrongToken = 'TESTFOLD_INCORRECT'
  const wrongGameId = 'WRONG_ID'
  const correctId = '1'
  request(app)
    .get(`/actionFold?playerToken=${wrongToken}`)
    .expect(400)
    .end(done)

  request(app)
    .get(`/actionFold?playerToken=${wrongToken}&gameId=${wrongGameId}`)
    .expect(400)
    .end(done)
  request(app)
    .get(`/actionFold?playerToken=${wrongToken}&gameId=${correctId}`)
    .expect(402)
    .end(done)
})

test('Fold, correct arguments, wrong turn', async () => {
  const gameMasterToken = 'FOLDTEST'
  const gameMasterNick = 'FOLDNICK'
  const playerToken = 'FOLDTEST2'
  const playerNick = 'FOLDNICK2'
  const player2Token = 'FOLDTEST3'
  const player2Nick = 'FOLDNICK3'

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
    await request(app)
      .get(`/actionFold?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(403)

    await request(app)
      .get(`/actionFold?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(201)
    const getRound = 'SELECT game_round FROM Games WHERE game_id=$1'

    expect(
      await (
        await client.query(getRound, [gameId])
      ).rows[0].game_round
    ).toEqual('1') // because last guy has won - no new rounds then.
  })
})
