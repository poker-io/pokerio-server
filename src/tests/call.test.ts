import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import type { NewGameInfo } from '../utils/types'
import { getGameIdAndStatus, getPlayersInGame } from '../utils/commonRequest'
import './testSuiteTeardown'

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

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[1].token}&gameId=${gameId}&amount=5`
      )
      .expect(402)

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
      .expect(404)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[2].token}&gameId=${gameId}&amount=2000000000`
      )
      .expect(403)

    await request(app)
      .get(
        `/actionRaise?playerToken=${players[2].token}&gameId=${gameId}&amount=400`
      )
      .expect(200)

    await request(app)
      .get(`/actionCall?playerToken=${players[0].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[1].token}&gameId=${gameId}`)
      .expect(200)

    await request(app)
      .get(`/actionFold?playerToken=${players[2].token}&gameId=${gameId}`)
      .expect(402) // round ended
  })
}, 20000)
