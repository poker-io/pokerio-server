import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import './testSuiteTeardown'

test('Create game, wrong args', (done) => {
  request(app).get('/createGame/?creatorToken=-1').expect(400).end(done)

  request(app).get('/createGame').expect(400).end(done)

  request(app)
    .get('/createGame/?creatorToken=1&startingFunds=asdasd')
    .expect(400)
    .end(done)

  request(app)
    .get('/createGame/?creatorToken=1&startingFunds=2&smallBlind=-32')
    .expect(400)
    .end(done)

  request(app).get('/createGame/?creatorToken=1').expect(400).end(done)

  request(app)
    .get(
      `
      /createGame/?creatorToken=VERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERY
      LONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLO
      NGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGS
      TRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRI
      NGVERYLONGSTRINGVERYLONGSTRINGVERYLONGSTRING
      `
    )
    .expect(400)
    .end(done)

  request(app)
    .get('/createGame/?creatorToken=1&nickname=LongerThanTwentyString')
    .expect(400)
    .end(done)
})

test('Create game, player already exists', async () => {
  const gameMasterToken = 'TESTCREATE'
  const gameMasterNick = 'NICKCREATE'

  await runRequestWithClient(undefined, async (client) => {
    await request(app)
      .get(
        '/createGame/?creatorToken='
          .concat(gameMasterToken)
          .concat('&nickname=')
          .concat(gameMasterNick)
      )
      .expect(200)
    await request(app)
      .get(
        '/createGame/?creatorToken='
          .concat(gameMasterToken)
          .concat('&nickname=')
          .concat(gameMasterNick)
      )
      .expect(402)
    const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
    await client.query(deleteGameQuery, [gameMasterToken]).catch((err) => {
      console.log(err.stack)
    })
    const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'
    await client.query(deletePlayerQuery, [gameMasterToken]).catch((err) => {
      console.log(err.stack)
    })
  })
})

test('Create game, good args, good player', async () => {
  const gameMasterToken = 'TESTCREATE'
  const nick = 'NICKCREATE'

  await runRequestWithClient(undefined, async (client) => {
    await request(app)
      .get(
        '/createGame/?creatorToken='
          .concat(gameMasterToken)
          .concat('&nickname=')
          .concat(nick)
      )
      .expect(200)

    const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
    await client.query(deleteGameQuery, [gameMasterToken]).catch((err) => {
      console.log(err.stack)
    })
    const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'
    await client.query(deletePlayerQuery, [gameMasterToken]).catch((err) => {
      console.log(err.stack)
    })
  })
})
