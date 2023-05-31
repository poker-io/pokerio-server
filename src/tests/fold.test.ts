import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import { PlayerState, type NewGameInfo } from '../utils/types'
import {
  calculateWinner,
  getGameIdAndStatus,
  getPlayersInGame,
} from '../utils/commonRequest'
import './testSuiteTeardown'

test('Fold, wrong args', (done) => {
  const wrongToken = 'TESTFOLD_INCORRECT'
  const wrongGameId = 'WRONG_ID'
  request(app)
    .get(`/actionFold?playerToken=${wrongToken}`)
    .expect(400)
    .end(done)

  request(app)
    .get(`/actionFold?playerToken=${wrongToken}&gameId=${wrongGameId}`)
    .expect(400)
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
}, 20000)

test('calculate winner', async () => {
  const gameMasterToken = 'CALCUlATETEST'
  const gameMasterNick = 'CALCUlATENICK'
  const playerToken = 'CALCUlATETEST2'
  const playerNick = 'CALCUlATENICK2'
  const player2Token = 'CALCUlATETEST3'
  const player2Nick = 'CALCUlATENICK3'

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

    await client.query('UPDATE players SET last_action=$1 WHERE game_id=$2', [
      PlayerState.Called,
      gameId,
    ])
    await request(app)
      .get(`/actionFold?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)
    await client.query('UPDATE players SET CARD1=$1, CARD2=$2 WHERE token=$3', [
      '01K',
      '01O',
      players[1].token,
    ])
    await client.query('UPDATE players SET CARD1=$1, CARD2=$2 WHERE token=$3', [
      '13K',
      '13O',
      players[2].token,
    ])
    await client.query(
      'UPDATE games SET CARD1=$1, CARD2=$2, CARD3=$3, CARD4=$4, CARD5=$5  WHERE game_id=$6',
      ['02K', '03O', '05K', '07O', '08P', gameId]
    )
    let calculateResult = await calculateWinner(gameId, client)
    expect(calculateResult.includes(players[1].token)).toBe(true)
    expect(calculateResult.includes(players[2].token)).toBe(false)
    expect(calculateResult.includes(players[0].token)).toBe(false)
    await client.query('UPDATE players SET CARD1=$1, CARD2=$2 WHERE token=$3', [
      '01P',
      '01T',
      players[2].token,
    ])
    calculateResult = await calculateWinner(gameId, client)
    expect(calculateResult.includes(players[1].token)).toBe(true)
    expect(calculateResult.includes(players[2].token)).toBe(true)
    expect(calculateResult.includes(players[0].token)).toBe(false)
  })
}, 20000)
