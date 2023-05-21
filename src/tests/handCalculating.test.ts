import request from 'supertest'
import { app } from '../app'
import { getClient } from '../utils/databaseConnection'
import { PlayerState, type NewGameInfo } from '../utils/types'
import { calculateWinner, getGameIdAndStatus, getPlayersInGame } from '../utils/commonRequest'

test('Fold, correct arguments, wrong turn', async () => {
  const gameMasterToken = 'FOLDTEST'
  const gameMasterNick = 'FOLDNICK'
  const playerToken = 'FOLDTEST2'
  const playerNick = 'FOLDNICK2'
  const player2Token = 'FOLDTEST3'
  const player2Nick = 'FOLDNICK3'

  const client = getClient()
  await client.connect()
  const res = await request(app)
    .get(
      `/createGame?creatorToken=${gameMasterToken}&nickname=${gameMasterNick}`
    )
    .expect(200)

  const key = (res.body as NewGameInfo).gameId
  await request(app)
    .get(
      `/joinGame?playerToken=${playerToken}&nickname=${playerNick}&gameId=${key}`
    )
    .expect(200)

  await request(app)
    .get(
      `/joinGame?playerToken=${player2Token}&nickname=${player2Nick}&gameId=${key}`
    )
    .expect(200)

  await request(app)
    .get(`/startGame?creatorToken=${gameMasterToken}`)
    .expect(200)

  const gameId =
    (await getGameIdAndStatus(gameMasterToken, client)).gameId ?? ''
  const players = await getPlayersInGame(gameId, client)

  await client.query('UPDATE players SET last_action=$1 WHERE game_id=$2', [PlayerState.Called, gameId])
  await request(app)
    .get(`/fold?playerToken=${players[0].token}&gameId=${gameId}`)
    .expect(200)
  const resTemp = await client.query('SELECT * FROM players WHERE game_id=$1', [gameId])
  console.log(resTemp.rows)
  console.log('AND THE WINNER IS::\n')
  console.log(await calculateWinner(gameId, client))

  await client.end()
}, 20000)
