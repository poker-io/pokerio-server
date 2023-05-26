import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import './afterAll'

test('Modify game, wrong args', async () => {
  const insertGameCreator =
    'INSERT INTO Players (token, nickname, turn) VALUES ($1, $2, $3)'
  const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'

  await runRequestWithClient(undefined, async (client) => {
    try {
      await request(app).get('/modifyGame').expect(400)
      await request(app).get('/modifyGame?creatorToken=2137').expect(400)

      await client.query(insertGameCreator, [2137, '2137', 0])

      await request(app).get('/modifyGame?creatorToken=2137').expect(400)
      await request(app)
        .get('/modifyGame?creatorToken=2137&smallBlind=asd')
        .expect(400)
      await request(app)
        .get('/modifyGame?creatorToken=2137&startingFunnds=dasdasd')
        .expect(400)
      await request(app)
        .get('/modifyGame?creatorToken=2137&startingFunds=1&smallBlind=220')
        .expect(400)
    } finally {
      await client.query(deletePlayerQuery, [2137])
    }
  })
})

test('Modify game, correct arguments', async () => {
  const gameMasterToken = 'TESTMODIFY'
  const gameMasterNick = 'MODIFYNICK'
  const newSmallBlind = 2137
  const newStartingFunds = 1337
  const findGameQuery = 'SELECT game_id FROM Games WHERE game_master=$1'
  const deleteGameQuery = 'DELETE FROM Games WHERE game_id=$1'
  const verifyGameWasModifiedQuery =
    'SELECT game_id FROM Games WHERE game_id=$1 AND small_blind=$2 AND starting_funds=$3'
  const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'
  let gameId

  await runRequestWithClient(undefined, async (client) => {
    try {
      await request(app)
        .get(
          '/createGame?creatorToken='
            .concat(gameMasterToken)
            .concat('&nickname=')
            .concat(gameMasterNick)
        )
        .expect(200)

      await request(app)
        .get(
          '/modifyGame?creatorToken='
            .concat(gameMasterToken)
            .concat('&smallBlind=')
            .concat(newSmallBlind.toString())
            .concat('&startingFunds=')
            .concat(newStartingFunds.toString())
        )
        .expect(200)

      const findGameResult = await client.query(findGameQuery, [
        gameMasterToken,
      ])
      gameId = findGameResult.rows[0].game_id.toString()

      const verifyGameWasModifiedResult = await client.query(
        verifyGameWasModifiedQuery,
        [gameId, newSmallBlind, newStartingFunds]
      )
      expect(verifyGameWasModifiedResult.rowCount).toEqual(1)
    } finally {
      await client.query(deleteGameQuery, [gameId]).catch((err) => {
        console.log(err.stack)
      })
      await client.query(deletePlayerQuery, [gameMasterToken]).catch((err) => {
        console.log(err.stack)
      })
    }
  })
})
