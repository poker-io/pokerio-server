import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'

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

test('Create game, good args, good player', async () => {
  const imposibleFirbaseToken = 'TEST'
  const nick = 'NICK'
  const client = getClient()
  await client.connect()

  await request(app)
    .get(
      '/createGame/?creatorToken='
        .concat(imposibleFirbaseToken)
        .concat('&nickname=')
        .concat(nick)
    )
    .expect(200)

  const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
  await client.query(deleteGameQuery, [imposibleFirbaseToken]).catch((err) => {
    console.log(err.stack)
  })
  const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'
  await client
    .query(deletePlayerQuery, [imposibleFirbaseToken])
    .catch((err) => {
      console.log(err.stack)
    })

  await client.end()
})
