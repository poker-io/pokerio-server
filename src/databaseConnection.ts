import oracledb, { type Connection } from 'oracledb'
import {
  oracleConnectionString,
  oraclePassword,
  oracleUser,
} from './secrets.js'

export async function databaseConnect(): Promise<Connection> {
  return await oracledb.getConnection({
    user: oracleUser,
    password: oraclePassword,
    connectionString: oracleConnectionString,
  })
}

export async function databaseInit(): Promise<void> {
  // Connect
  let connection: Connection | undefined

  // Create the tables
  // This will fail if tables already exist, but we don't care
  try {
    connection = await databaseConnect()

    try {
      await connection.execute(
        `CREATE TABLE Players (
          id NUMBER GENERATED ALWAYS as IDENTITY(START with 1 INCREMENT by 1) PRIMARY KEY,
          token VARCHAR(250) NOT NULL,
          nickname VARCHAR(20) NOT NULL,
          turn INTEGER NOT NULL,
          game_id VARCHAR(6),
          card1 VARCHAR(3),
          card2 VARCHAR(3),
          funds INTEGER,
          bet INTEGER
        )`
      )
    } catch (err) {
      console.error(err)
    }

    try {
      await connection.execute(
        `CREATE TABLE Games (
          game_id VARCHAR(6) PRIMARY KEY,
          game_master NOT NULL REFERENCES Players,
          card1 VARCHAR(3),
          card2 VARCHAR(3),
          card3 VARCHAR(3),
          card4 VARCHAR(3),
          card5 VARCHAR(3),
          game_round INTEGER DEFAULT 0 NOT NULL,
          starting_funds INTEGER NOT NULL,
          small_blind INTEGER NOT NULL,
          small_blind_who REFERENCES Players,
          current_table_value INTEGER,
          current_player REFERENCES Players
        )`
      )
    } catch (err) {
      console.error(err)
    }
  } catch (err) {
    console.error(err)
  } finally {
    if (connection !== undefined) {
      try {
        await connection.close()
      } catch (err) {
        console.error(err)
      }
    }
  }
}

export function boolToInt(bool: boolean): number {
  return bool ? 1 : 0
}
