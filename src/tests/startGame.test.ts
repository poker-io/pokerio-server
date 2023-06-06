import { app } from '../app'
import request from 'supertest'
import { runRequestWithClient } from '../utils/databaseConnection'
import { SMALL_BLIND_DEFAULT } from '../utils/commonRequest'
import './testSuiteTeardown'

test('Start game, wrong args', async () => {
  const gameMasterToken = 'TESTSTART1'
  const gameMasterNick = 'TESTSTARTNICK1'
  const deleteGameQuery = 'DELETE FROM Games WHERE game_master=$1'
  const deletePlayerQuery = 'DELETE FROM Players WHERE token = $1'

  await runRequestWithClient(undefined, async (client) => {
    try {
      await request(app).get('/startGame').expect(400)
      await request(app)
        .get(`/startGame?creatorToken=${gameMasterToken}`)
        .expect(402)

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
        .expect(403)
    } finally {
      await client.query(deleteGameQuery, [gameMasterToken])
      await client.query(deletePlayerQuery, [gameMasterToken])
    }
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

      const findGameResult = await client.query(findGameQuery, [
        gameMasterToken,
      ])
      gameId = findGameResult.rows[0].game_id.toString()
      funds = findGameResult.rows[0].starting_funds

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

      const game = await client.query(verifyGameHasStarted, [gameId])
      // Check if game has started.
      expect(game.rows[0].current_player).not.toBeNull()
      expect(game.rows[0].small_blind_who).not.toBeNull()
      const smallBlindTurnResult = await client.query(
        'SELECT turn from Players where token = $1',
        [game.rows[0].small_blind_who]
      )
      expect(smallBlindTurnResult.rows[0].turn).toEqual('1')
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

      const playersResult = await client.query(verifyPlayersHaveCardsAndFunds, [
        gameMasterToken,
        player1Token,
        player2Token,
      ])
      expect(playersResult.rowCount).toEqual(3)
      for (let i = 0; i < playersResult.rowCount; i++) {
        expect(playersResult.rows[i].card1).not.toBeNull()
        expect(playersResult.rows[i].card2).not.toBeNull()
        expect(playersResult.rows[i].card1).not.toEqual(
          playersResult.rows[i].card2
        )
        if (i === playersResult.rowCount - 1) {
          expect(parseInt(playersResult.rows[i].funds)).toEqual(
            funds - SMALL_BLIND_DEFAULT * 2
          )
        } else if (i === playersResult.rowCount - 2) {
          expect(parseInt(playersResult.rows[i].funds)).toEqual(
            funds - SMALL_BLIND_DEFAULT
          )
        } else {
          expect(playersResult.rows[i].funds).toEqual(funds)
        }
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
    } finally {
      await client.query(deleteGameQuery, [gameId]).catch((err) => {
        console.log(err.stack)
      })
      await client
        .query(deletePlayerQuery, [gameMasterToken, player1Token, player2Token])
        .catch((err) => {
          console.log(err.stack)
        })
    }
  })
})
