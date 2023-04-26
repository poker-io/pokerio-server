import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'

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
  const client = getClient()
  await client.connect()

  await request(app)
    .get(
      '/createGame/?creatorToken='
        .concat(gameMasterToken)
        .concat('&nickname=')
        .concat(gameMasterNick)
    )
    .expect(200)

  await request(app) // Creator exists, but the player does not
    .get(
      '/kickPlayer?creatorToken='
        .concat(gameMasterToken)
        .concat('&playerToken=2137')
    )
    .expect(400)

  const findGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
  const verifyNoPlayerQuery = 'SELECT token FROM Players WHERE token=$1'
  const getNewSmallBlindCurrentPlayer =
    'SELECT small_blind_who FROM Games WHERE game_id=$1'
  const verifyMinQuery =
    'SELECT token FROM Players WHERE token=$1 AND game_id=$2 AND turn IN (SELECT MIN(turn) FROM Players WHERE game_id=$2)'
  await client
    .query(findGameQuery, [gameMasterToken])
    .then(async (result) => {
      const gameId = result.rows[0].game_id.toString()
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(playerToken)
            .concat('&nickname=')
            .concat(playerNick)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(200)

      await request(app)
        .get(
          '/kickPlayer?'.concat(
            'creatorToken='
              .concat(gameMasterToken)
              .concat('&playerToken='.concat(playerToken))
          )
        )
        .expect(200)

      await client.query(verifyNoPlayerQuery, [playerToken]).then((res) => {
        expect(res.rowCount).toEqual(0)
      })

      await client
        .query(getNewSmallBlindCurrentPlayer, [gameId])
        .then(async (newSmallest) => {
          await client
            .query(verifyMinQuery, [
              newSmallest.rows[0].small_blind_who,
              gameId,
            ])
            .then((res) => {
              expect(newSmallest.rows[0].small_blind_who).toEqual(
                res.rows[0].token
              )
            })
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
      client.end()
    })
})
