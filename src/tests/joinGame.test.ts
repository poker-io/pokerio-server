import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'
import type { GameSettings } from '../app'
import sha256 from 'crypto-js/sha256'

test('Join game, wrong args', (doneJoin) => {
  request(app)
    .get('/joinGame/?playerToken=-1&nickname=yellow&gameID=TESTJOIN')
    .expect(400)
    .end(doneJoin) // Bad token.
  request(app).get('/joinGame').expect(400).end(doneJoin) // No args.
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=11&gameId=TESTJOIN')
    .expect(400)
    .end(doneJoin) // Bad nickname.
  request(app)
    .get(
      '/joinGame/?playerToken=TESTJOIN1&nickname=LongerThanTwentyString&gameId=TESTJOIN'
    )
    .expect(400)
    .end(doneJoin) // Nickname too long.
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=yellow&gameId=TESTJOIN')
    .expect(400)
    .end(doneJoin) // Bad game id format.
  request(app)
    .get('/joinGame/?playerToken=TESTJOIN1&nickname=yellow&gameId=11')
    .expect(401)
    .end(doneJoin) // Game does not exist.
})

test('Join game, correct arguments', async () => {
  const gameMasterToken = 'TESTJOIN'
  const playerToken = 'TESTJOIN2'
  const gameMasterNick = 'NICKJOIN'
  const playerNick = 'NICKJOIN2'
  const playerToken2 = 'TESTJOIN3'
  const playerNick2 = 'NICKJOIN3'
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

  const expectedInfo: GameSettings = {
    smallBlind: 60,
    startingFunds: 2137,
    players: [
      {
        nickname: gameMasterNick,
        playerHash: sha256(gameMasterToken).toString(),
      },
    ],
    gameMasterHash: sha256(gameMasterToken).toString(),
  }
  let gameId = 'game_not_found'
  const findGameQuery = 'SELECT game_id FROM Games where game_master=$1'
  await client
    .query(findGameQuery, [gameMasterToken])
    .then(async (result) => {
      gameId = result.rows[0].game_id.toString()
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(playerToken)
            .concat('&nickname=')
            .concat(playerNick)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(expectedInfo)

      // Cannot join twice.
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(playerToken)
            .concat('&nickname=')
            .concat(playerNick)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(400)

      // Cannot join after game started.
      await request(app)
        .get('/startGame/?creatorToken='.concat(gameMasterToken))
        .expect(200)
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(playerToken2)
            .concat('&nickname=')
            .concat(playerNick2)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(401)
    })
    .finally(async () => {
      const deleteGameQuery = 'DELETE FROM Games WHERE game_master = $1'
      await client.query(deleteGameQuery, [gameMasterToken]).catch((err) => {
        console.log(err.stack)
      })
      const deletePlayerQuery =
        'DELETE FROM Players WHERE token = $1 or token = $2 or token = $3'
      await client
        .query(deletePlayerQuery, [playerToken, gameMasterToken, playerToken2])
        .catch((err) => {
          console.log(err.stack)
        })
      await client.end()
    })
}, 20000)
