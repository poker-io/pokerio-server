import { app } from '../app'
import request from 'supertest'
import { getClient } from '../databaseConnection'

test('Join game, wrong args', (doneJoin) => {
  request(app)
    .get('/joinGame/?playerToken=-1&nickname=yellow&gameID=TESTJOIN')
    .expect(400)
    .end(doneJoin) // bad token
  request(app).get('/joinGame').expect(400).end(doneJoin) // no args
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=11&gameId=TESTJOIN')
    .expect(400)
    .end(doneJoin) // bad nickname
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=LongerThanTwentyString&gameId=TESTJOIN')
    .expect(400)
    .end(doneJoin) // nickname too long
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=yellow&gameId=TESTJOIN')
    .expect(400)
    .end(doneJoin) // bad game id format
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=yellow&gameId=11')
    .expect(401)
    .end(doneJoin) // game does not exist
})

test('Join game, correct arguments', async () => {
  const imposibleFirbaseToken = 'TESTJOIN'
  const playerToken = 'TESTJOIN2'
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

  let gameId = 'game_not_found'
  const findGameQuery = 'SELECT game_id FROM Games where game_master=$1'
  await client.query(findGameQuery, [imposibleFirbaseToken]).then(
    async (result) => {
      gameId = (result.rows[0].game_id).toString()
      await request(app)
        .get('/joinGame/?playerToken='
          .concat(playerToken)
          .concat('&nickname=yellow&gameId=')
          .concat(gameId))
        .expect(200)
      const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
      await client.query(deleteGameQuery, [imposibleFirbaseToken])
        .catch((err) => {
          console.log(err.stack)
        })
      const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1 or token = $2'
      await client
        .query(deletePlayerQuery, [playerToken, imposibleFirbaseToken])
        .catch((err) => {
          console.log(err.stack)
        })
    }).finally(() => { client.end() })
})
