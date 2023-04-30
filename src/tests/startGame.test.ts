import { app } from '../app'
import request from 'supertest'
import { getClient } from '../utils/databaseConnection'

test('Start game, wrong args', async () => {
  const client = getClient()
  const gameMasterToken = 'TESTSTART1'
  const gameMasterNick = 'TESTSTARTNICK1'
  const deleteGameQuery = 'DELETE FROM Games WHERE game_master=$1'
  const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'

  await client
    .connect()
    .then(async () => {
      await request(app).get('/startGame').expect(400)
      await request(app)
        .get(`/startGame?creatorToken=${gameMasterToken}`)
        .expect(400)

      await request(app)
        .get(
          '/createGame?creatorToken='
            .concat(gameMasterToken)
            .concat('&nickname=')
            .concat(gameMasterNick)
        )
        .expect(200)

      // Not enough players.
      await request(app)
        .get(`/startGame?creatorToken=${gameMasterToken}`)
        .expect(400)
    })
    .finally(async () => {
      await client.query(deleteGameQuery, [gameMasterToken])
      await client.query(deletePlayerQuery, [gameMasterToken])
      await client.end()
    })
})

test('Start game, correct arguments', async () => {
  const gameMasterToken = 'TESTSTART2'
  const gameMasterNick = 'TESTSTARTNICK2'
  const player1Token = 'TESTSTART3'
  const player2Token = 'TESTSTART4'
  const player2Nick = 'TESTSTARTNICK4'
  const player1Nick = 'TESTSTARTNICK3'
  const findGameQuery =
    'SELECT game_id, starting_funds FROM Games WHERE game_master=$1'
  const deleteGameQuery = 'DELETE FROM Games WHERE game_id=$1'
  const verifyGameHasStarted = `SELECT card1, card2, card3, card4, card5, current_player, small_blind_who, 
        current_table_value FROM Games WHERE game_id=$1`
  const verifyPlayersHaveCardsAndFunds =
    'SELECT card1, card2, funds FROM Players WHERE token=$1 OR token=$2 OR token=$3'
  const deletePlayerQuery =
    'DELETE FROM Players WHERE token = $1 OR token = $2 OR token = $3'
  let gameId
  let funds

  const client = getClient()
  await client.connect()

  await request(app)
    .get(
      '/createGame?creatorToken='
        .concat(gameMasterToken)
        .concat('&nickname=')
        .concat(gameMasterNick)
    )
    .expect(200)

  await client
    .query(findGameQuery, [gameMasterToken])
    .then(async (result) => {
      gameId = result.rows[0].game_id.toString()
      funds = result.rows[0].starting_funds
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(player1Token)
            .concat('&nickname=')
            .concat(player1Nick)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(200)
      await request(app)
        .get(
          '/joinGame/?playerToken='
            .concat(player2Token)
            .concat('&nickname=')
            .concat(player2Nick)
            .concat('&gameId=')
            .concat(gameId)
        )
        .expect(200)

      await request(app)
        .get('/startGame/?creatorToken='.concat(gameMasterToken))
        .expect(200)

      await client.query(verifyGameHasStarted, [gameId]).then(async (game) => {
        // Check if game has started.
        expect(game.rows[0].current_player).not.toBeNull()
        expect(game.rows[0].small_blind_who).not.toBeNull()
        expect(game.rows[0].small_blind_who).toEqual(
          game.rows[0].current_player
        )
        expect(game.rows[0].current_table_value).not.toBeNull()
        // Check cards.
        expect(game.rows[0].card1).not.toBeNull()
        expect(game.rows[0].card2).not.toBeNull()
        expect(game.rows[0].card3).not.toBeNull()
        expect(game.rows[0].card4).not.toBeNull()
        expect(game.rows[0].card5).not.toBeNull()
        // No duplicates.
        expect(game.rows[0].card5).not.toEqual(game.rows[0].card4)
        expect(game.rows[0].card5).not.toEqual(game.rows[0].card3)
        expect(game.rows[0].card5).not.toEqual(game.rows[0].card2)
        expect(game.rows[0].card5).not.toEqual(game.rows[0].card1)
        expect(game.rows[0].card4).not.toEqual(game.rows[0].card3)
        expect(game.rows[0].card4).not.toEqual(game.rows[0].card2)
        expect(game.rows[0].card4).not.toEqual(game.rows[0].card1)
        expect(game.rows[0].card3).not.toEqual(game.rows[0].card2)
        expect(game.rows[0].card3).not.toEqual(game.rows[0].card1)
        expect(game.rows[0].card2).not.toEqual(game.rows[0].card1)
      })
      await client
        .query(verifyPlayersHaveCardsAndFunds, [
          gameMasterToken,
          player1Token,
          player2Token,
        ])
        .then(async (playersResult) => {
          expect(playersResult.rowCount).toEqual(3)
          for (let i = 0; i < playersResult.rowCount; i++) {
            expect(playersResult.rows[i].card1).not.toBeNull()
            expect(playersResult.rows[i].card2).not.toBeNull()
            expect(playersResult.rows[i].card1).not.toEqual(
              playersResult.rows[i].card2
            )
            expect(playersResult.rows[i].funds).toEqual(funds)
          }
          // No duplicates.
          expect(playersResult.rows[0].card1).not.toEqual(
            playersResult.rows[1].card1
          )
          expect(playersResult.rows[0].card1).not.toEqual(
            playersResult.rows[1].card2
          )
          expect(playersResult.rows[0].card2).not.toEqual(
            playersResult.rows[1].card1
          )
          expect(playersResult.rows[0].card2).not.toEqual(
            playersResult.rows[1].card2
          )
          expect(playersResult.rows[0].card1).not.toEqual(
            playersResult.rows[2].card1
          )
          expect(playersResult.rows[0].card1).not.toEqual(
            playersResult.rows[2].card2
          )
          expect(playersResult.rows[0].card2).not.toEqual(
            playersResult.rows[2].card1
          )
          expect(playersResult.rows[0].card2).not.toEqual(
            playersResult.rows[2].card2
          )
          expect(playersResult.rows[1].card1).not.toEqual(
            playersResult.rows[2].card1
          )
          expect(playersResult.rows[1].card1).not.toEqual(
            playersResult.rows[2].card2
          )
          expect(playersResult.rows[1].card2).not.toEqual(
            playersResult.rows[2].card1
          )
          expect(playersResult.rows[1].card2).not.toEqual(
            playersResult.rows[2].card2
          )
        })
    })
    .finally(async () => {
      await client.query(deleteGameQuery, [gameId]).catch((err) => {
        console.log(err.stack)
      })
      await client
        .query(deletePlayerQuery, [gameMasterToken, player1Token, player2Token])
        .catch((err) => {
          console.log(err.stack)
        })
      await client.end()
    })
}, 20000)
