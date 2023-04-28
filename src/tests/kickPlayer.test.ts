import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'
import sha256 from 'crypto-js/sha256'
import { type newGameInfo } from '../app'

test('Kick player, wrong args', (done) => {
  request(app).get('/kickPlayer').expect(400).end(done)
  request(app).get('/kickPlayer?creatorToken=2137').expect(400).end(done)
  request(app).get('/kickPlayer?playerToken=1337').expect(400).end(done)

  request(app)
    .get('/kickPlayer?playerToken=1337'.concat('&creatorToken=1337'))
    .expect(400)
    .end(done)
})

test('Kick player, correct arguments', async () => {
  const gameMasterToken = 'TESTKICK'
  const playerToken = 'TESTKICK2'
  const gameMasterNick = 'NICKKICK'
  const playerNick = 'NICKKICK2'

  const res = await request(app)
    .get(
      '/createGame/?creatorToken='
        .concat(gameMasterToken)
        .concat('&nickname=')
        .concat(gameMasterNick)
    )
    .expect(200)
  const gameId = (res.body as newGameInfo).gameKey

  // Creator exists, but the player does not
  await request(app)
    .get(
      '/kickPlayer?creatorToken='
        .concat(gameMasterToken)
        .concat('&playerToken=2137')
    )
    .expect(400)

  const verifyNoPlayerQuery = 'SELECT token FROM Players WHERE token=$1'

  const client = getClient()
  await client
    .connect()
    .then(async () => {
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(playerToken)
            .concat('&nickname=')
            .concat(playerNick)
            .concat('&gameId=')
            .concat(gameId.toString())
        )
        .expect(200)

      await request(app)
        .get(
          '/kickPlayer?'.concat(
            'creatorToken='
              .concat(gameMasterToken)
              .concat('&playerToken='.concat(sha256(playerToken).toString()))
          )
        )
        .expect(200)

      await client.query(verifyNoPlayerQuery, [playerToken]).then((res) => {
        expect(res.rowCount).toEqual(0)
      })
    })
    .finally(async () => {
      const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
      await client.query(deleteGameQuery, [gameMasterToken]).catch((err) => {
        console.log(err.stack)
      })
      const deletePlayerQuery =
        'DELETE FROM Players WHERE token = $1 or token = $2'
      await client
        .query(deletePlayerQuery, [playerToken, gameMasterToken])
        .catch((err) => {
          console.log(err.stack)
        })
      await client.end()
    })
}, 60000)
