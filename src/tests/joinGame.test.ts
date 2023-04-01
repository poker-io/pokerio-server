import { app } from '../app'
import request from 'supertest'
import { getClient } from '../databaseConnection'

test('Join game, wrong args', async () => {
  const imposibleFirbaseToken = 'TESTJOIN'
  const nick = 'NICKJOIN'
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

  const findGameQuery = 'SELECT game_id FROM Games where game_master=$1'
  await client.query(findGameQuery, [imposibleFirbaseToken]).then(
    async (result) => {
      const gameID = (result.rows[0].game_id).toString()
      request(app)
        .get('/joinGame/?playerToken=-1&nickname=yellow&game_id='.concat(gameID))
        .expect(400) // bad token

      request(app).get('/joinGame').expect(400) // no args
      request(app)
        .get('/joinGame/?playerToken=1&nickname=11&gameID=1')
        .expect(400) // bad nickname

      request(app)
        .get('/createGame/?playerToken=1&nickname=LongerThanTwentyString&game_id='.concat(gameID))
        .expect(400) // nickname too long

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
      request(app)
        .get('/createGame/?playerToken=1&nickname=yellow&game_id='.concat(gameID))
        .expect(401) // game does not exist

      await client.end()
    }
  ).catch((err) => {
    console.log(err.stack)
  })
  await client.end()
})
