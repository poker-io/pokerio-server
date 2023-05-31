import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import type { NewGameInfo } from '../utils/types'
import {
  STARTING_FUNDS_DEFAULT,
  getGameIdAndStatus,
  getPlayersInGame,
} from '../utils/commonRequest'
import './testSuiteTeardown'

test('Call, wrong args', (done) => {
  request(app).get('/actionCall').expect(400).end(done)
  request(app).get('/actionCall?playerToken=2137').expect(400).end(done)
  request(app).get('/actionCall?gameId=2137').expect(400).end(done)
  request(app)
    .get('/actionCall?playerToken=2137&gameId=2137')
    .expect(402)
    .end(done)
})

test('Call, correct arguments 1', async () => {
  const gameMasterToken = 'CALLTEST'
  const gameMasterNick = 'CALLNICK'
  const playerToken = 'CALLTEST2'
  const playerNick = 'CALLNICK2'
  const player2Token = 'CALLTEST3'
  const player2Nick = 'CALLNICK3'

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

    const gameId =
      (await getGameIdAndStatus(gameMasterToken, client)).gameId ?? ''
    const players = await getPlayersInGame(gameId, client)

    // not his turn
    await request(app)
      .get(`/actionCall?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(403)

    const takeAllMoneyQuery = 'UPDATE Players SET funds=10 WHERE token=$1'
    await client.query(takeAllMoneyQuery, [players[0].token])
    // not enough money
    await request(app)
      .get(`/actionCall?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(404)

    const resetMoneyQuery = 'UPDATE Players SET funds=$1 WHERE token=$2'
    await client.query(resetMoneyQuery, [
      STARTING_FUNDS_DEFAULT,
      players[0].token,
    ])

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[1].token}&gameId=${gameId}&amount=5`
      )
      .expect(403)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[0].token}&gameId=${gameId}&amount=300`
      )
      .expect(200)

    await request(app)
      .get(`/actionCall?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(200)
    const getRound = 'SELECT game_round FROM Games WHERE game_id=$1'

    expect(
      await (
        await client.query(getRound, [gameId])
      ).rows[0].game_round
    ).toEqual('1') // Player 2 can still act

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[2].token}&gameId=${gameId}&amount=2`
      )
      .expect(405)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[2].token}&gameId=${gameId}&amount=2000000000`
      )
      .expect(404)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[2].token}&gameId=${gameId}&amount=400`
      )
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(`/actionCall?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(200)
  })
}, 20000)

test('Call, change round when small blind and bigblind folded', async () => {
  const gameMasterToken = 'CALL2TEST'
  const gameMasterNick = 'CALL2NICK'
  const playerToken = 'CALL2TEST2'
  const playerNick = 'CALL2NICK2'
  const player2Token = 'CALL2TEST3'
  const player2Nick = 'CALL2NICK3'
  const player3Token = 'CALL2TEST4'
  const player3Nick = 'CALL2NICK4'

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
      .get(
        `/joinGame?playerToken=${player3Token}&nickname=${player3Nick}&gameId=${key}`
      )
      .expect(200)

    await request(app)
      .get(`/startGame?creatorToken=${gameMasterToken}`)
      .expect(200)

    const gameId =
      (await getGameIdAndStatus(gameMasterToken, client)).gameId ?? ''
    const players = await getPlayersInGame(gameId, client)

    await request(app)
      .get(`/actionCall?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[1].token}&gameId=${gameId}&amount=300`
      )
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[2].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[3].token}&gameId=${gameId}`)
      .expect(200)

    // round should change, and player 0 should be able to act
    const getRound = 'SELECT game_round FROM Games WHERE game_id=$1'
    expect(
      await (
        await client.query(getRound, [gameId])
      ).rows[0].game_round
    ).toEqual('1')

    await request(app)
      .get(`/actionCall?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)

    expect(
      await (
        await client.query(getRound, [gameId])
      ).rows[0].game_round
    ).toEqual('2')

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[1].token}&gameId=${gameId}&amount=301`
      )
      .expect(403) // not his turn

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[0].token}&gameId=${gameId}&amount=301`
      )
      .expect(200) // not his turn

    await request(app)
      .get(`/actionFold?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(201) // game should end
  })
}, 20000)
