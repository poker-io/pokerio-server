import { app } from '../app'
import request from 'supertest'
import { getClient } from '../databaseConnection'
import type { gameSettings } from '../app'
import sha256 from 'crypto-js/sha256'

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
  const gameMasterToken = 'TESTJOIN'
  const playerToken = 'TESTJOIN2'
  const gameMasterNick = 'NICKJOIN'
  const playerNick = 'NICKJOIN2'
  const client = getClient()
  await client.connect()

  await request(app)
    .get(
      '/createGame/?creatorToken='
        .concat(gameMasterToken)
        .concat('&nickname=')
        .concat(gameMasterNick)
        .concat('&startingFunds=2137&smallBlind=60')
    )
    .expect(200)

  const expectedInfo: gameSettings = {
    smallBlind: 60,
    startingFunds: 2137,
    players: [{
      nickname: gameMasterNick,
      playerHash: sha256(gameMasterToken).toString()
    },
    {
      nickname: playerNick,
      playerHash: sha256(playerToken).toString()
    }],
    gameMasterHash: sha256(gameMasterToken).toString()
  }
  let gameId = 'game_not_found'
  const findGameQuery = 'SELECT game_id FROM Games where game_master=$1'
  await client.query(findGameQuery, [gameMasterToken]).then(
    async (result) => {
      gameId = (result.rows[0].game_id).toString()
      await request(app)
        .get('/joinGame/?playerToken='
          .concat(playerToken)
          .concat('&nickname=')
          .concat(playerNick)
          .concat('&gameId=')
          .concat(gameId))
        .expect(expectedInfo)
    }).finally(async () => {
    const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
    await client.query(deleteGameQuery, [gameMasterToken])
      .catch((err) => {
        console.log(err.stack)
      })
    const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1 or token = $2'
    await client
      .query(deletePlayerQuery, [playerToken, gameMasterToken])
      .catch((err) => {
        console.log(err.stack)
      })
    client.end()
  })
})
