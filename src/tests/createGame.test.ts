import { app } from '../app'
import request from 'supertest'
import { getClient } from '../databaseConnection'

async function genNonExistentPlayerNumber(client): Promise<number> {
  let badIndex: boolean = true
  let index = 0
  while (badIndex) {
    index = Math.floor(Math.random() * 100000)
    const res = await client.query(
      'SELECT * FROM Players WHERE id ='.concat(index.toString())
    )

    badIndex = Boolean(res.rows.length)
  }

  return index
}

test('Create game, wrong args', (done) => {
  request(app).get('/createGame/?creatorID=-1').expect(400).end(done)

  request(app).get('/createGame').expect(400).end(done)

  request(app)
    .get('/createGame/?creatorID=1&startingFunds=asdasd')
    .expect(400)
    .end(done)

  request(app)
    .get('/createGame/?creatorID=1&startingFunds=2&smallBlind=-32')
    .expect(400)
    .end(done)
})

test('Create game, good args, non existent player', async () => {
  const client = getClient()
  await client.connect()
  const index = await genNonExistentPlayerNumber(client)

  await request(app)
    .get('/createGame/?creatorID='.concat(index.toString()))
    .expect(400)

  await client.end()
})

test('Create game, good args, good player', async () => {
  const imposibleFirbaseToken = 'TEST'
  const client = getClient()
  await client.connect()
  const index = await genNonExistentPlayerNumber(client)

  const values = [
    index,
    imposibleFirbaseToken,
    'Test Nick',
    0,
    null,
    null,
    null,
    0,
    0,
  ]
  await client.query(
    'INSERT INTO Players(id, token, nickname, turn, game_id, card1, card2, funds, bet) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    values
  )

  await request(app)
    .get('/createGame/?creatorID='.concat(index.toString()))
    .expect(200)

  await client.query(
    'DELETE FROM Games WHERE game_master = '.concat(index.toString())
  )

  await client.query('DELETE FROM Players WHERE id = '.concat(index.toString()))

  await client.end()
})
