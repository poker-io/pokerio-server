import { Pool, type PoolClient } from 'pg'
import { user, password, database } from '../secrets'
import { type Response } from 'express-serve-static-core'
import { isTestingEnv } from './firebase'

const CREATE_PLAYERS_TABLE_QUERY = `CREATE TABLE IF NOT EXISTS Players (
    token VARCHAR(250) NOT NULL PRIMARY KEY,
    nickname VARCHAR(20) NOT NULL,
    turn BIGINT NOT NULL,
    game_id VARCHAR(6),
    card1 VARCHAR(3),
    card2 VARCHAR(3),
    funds BIGINT,
    bet BIGINT,
    last_action VARCHAR(10)
  )`

const CREATE_GAMES_TABLE_QUERY = `CREATE TABLE IF NOT EXISTS Games (
    game_id VARCHAR(6) PRIMARY KEY,
    game_master VARCHAR(250) REFERENCES Players(token) NOT NULL,
    card1 VARCHAR(3),
    card2 VARCHAR(3),
    card3 VARCHAR(3),
    card4 VARCHAR(3),
    card5 VARCHAR(3),
    game_round BIGINT DEFAULT 0 NOT NULL,
    starting_funds BIGINT NOT NULL,
    small_blind BIGINT NOT NULL,
    small_blind_who VARCHAR(250) REFERENCES Players(token),
    current_table_value BIGINT,
    current_player VARCHAR(250) REFERENCES Players(token)
  )`

const GENERATE_RANDOM_KEY_FUNCTION_QUERY = `CREATE OR REPLACE function insert_with_random_key (
    game_master TEXT,
    card1 TEXT,
    card2 TEXT,
    card3 TEXT,
    card4 TEXT,
    card5 TEXT,
    game_round NUMERIC,
    starting_funds NUMERIC,
    small_blind NUMERIC,
    small_blind_who TEXT,
    current_table_value NUMERIC,
    current_player TEXT)
  returns NUMERIC
  language plpgsql

  as
  $$
  declare
    game_id_rand NUMERIC := CAST(random() * 1000000 AS INT);
  begin
    

    INSERT INTO Games(game_id, game_master, card1, card2, card3, card4, 
        card5, game_round, starting_funds, small_blind, small_blind_who,
        current_table_value, current_player) 
    values (game_id_rand, game_master, card1, card2, card3, card4,
        card5, game_round, starting_funds, small_blind, 
        small_blind_who, current_table_value, current_player)
    ON CONFLICT DO NOTHING;

    if not found then return generic_insert(game_master, card1, card2,
        card3, card4, card5, game_round, starting_funds, small_blind, 
        small_blind_who, current_table_value, current_player);
    end if;

    return game_id_rand;
  end;
  $$;`

const pool = new Pool({
  user,
  password,
  database,
  port: 5432,
  host: 'localhost',
  max: 100,
})

export async function databaseInit(): Promise<void> {
  let success = false

  await runRequestWithClient(undefined, async (client) => {
    // Create the tables
    await client.query(CREATE_PLAYERS_TABLE_QUERY)
    await client.query(CREATE_GAMES_TABLE_QUERY)
    await client.query(GENERATE_RANDOM_KEY_FUNCTION_QUERY)

    success = true
  })

  if (success) {
    await Promise.resolve()
  } else {
    await Promise.reject(new Error('Failed to connect to database'))
  }
}

export async function runRequestWithClient(
  res: Response<any, Record<string, any>, number> | undefined,
  lambda: (client: PoolClient) => Promise<any>
) {
  const pgClient = await pool.connect()

  try {
    await lambda(pgClient)
  } catch (e: any) {
    res?.sendStatus(500)

    if (isTestingEnv()) {
      throw e
    } else {
      console.error('Error running request')
    }
  } finally {
    pgClient.release()
  }
}

export async function databaseShutdown() {
  await pool.end()
}
