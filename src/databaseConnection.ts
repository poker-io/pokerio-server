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

    await client.query(
      `create or replace function insert_with_random_key (game_master numeric,
            card1 text,
            card2 text,
            card3 text,
            card4 text,
            card5 text,
            game_round numeric,
            starting_funds numeric,
            small_blind numeric,
            small_blind_who numeric,
            current_table_value numeric,
            current_player numeric)
        returns numeric
        language plpgsql
        
        as
        $$
        declare
            game_id_rand numeric := CAST(random() * 1000000 AS INT);
        begin
            

            insert into Games(game_id, game_master, card1, card2, card3, card4, card5, game_round, starting_funds, small_blind, small_blind_who, current_table_value, current_player) values (game_id_rand, game_master, card1, card2, card3, card4, card5, game_round, starting_funds, small_blind, small_blind_who, current_table_value, current_player) on conflict do nothing;
        
            if not found then return generic_insert(game_master, card1, card2, card3, card4, card5, game_round, starting_funds, small_blind, small_blind_who, current_table_value, current_player);
             end if;
        
            return game_id_rand;
        end;
        $$;`
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
