import pg from 'pg'
import { user, password } from './secrets'
// pq is a CommonJS module, so we have to do it this way for the import to work
export const { Client } = pg

export function getClient(): any {
  return new Client({
    user,
    password,
    database: 'bd',
    port: 5432,
    host: 'localhost',
  })
}

export async function databaseInit(): Promise<void> {
  let success = true
  const client = getClient()
  try {
    // Connect
    await client.connect()

    // Create the tables
    // This will fail if tables already exist, but we don't care
    await client.query(
      `CREATE TABLE IF NOT EXISTS Players (
          id SERIAL UNIQUE NOT NULL,
          token VARCHAR(250) NOT NULL PRIMARY KEY,
          nickname VARCHAR(20) NOT NULL,
          turn BIGINT NOT NULL,
          game_id VARCHAR(6),
          card1 VARCHAR(3),
          card2 VARCHAR(3),
          funds BIGINT,
          bet BIGINT
        )`
    )

    await client.query(
      `CREATE TABLE IF NOT EXISTS Games (
          game_id VARCHAR(6) PRIMARY KEY,
          game_master SERIAL REFERENCES Players(id) NOT NULL,
          card1 VARCHAR(3),
          card2 VARCHAR(3),
          card3 VARCHAR(3),
          card4 VARCHAR(3),
          card5 VARCHAR(3),
          game_round BIGINT DEFAULT 0 NOT NULL,
          starting_funds BIGINT NOT NULL,
          small_blind BIGINT NOT NULL,
          small_blind_who SERIAL REFERENCES Players(id) NOT NULL,
          current_table_value BIGINT,
          current_player SERIAL REFERENCES Players(id) NOT NULL
        )`
    )

    // TODO move to testing
    await client.query(
      `INSERT INTO Players(token, nickname, turn, game_id, card1, card2, funds, bet) 
         VALUES('TestDatabaseConnectionToken', 'testNick', 0, NULL, NULL, NULL, NULL, NULL)
         ON CONFLICT (token)
         DO NOTHING
        `
    )
  } catch (err) {
    console.error(err)
    success = false
  } finally {
    try {
      await client.end()
    } catch (err) {
      console.error(err)
    }
  }

  if (success) {
    await Promise.resolve()
  } else {
    await Promise.reject(new Error('Failed to connect to database'))
  }
}
