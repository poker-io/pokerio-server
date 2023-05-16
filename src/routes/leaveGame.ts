import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'
import { type Client } from 'pg'
import { deletePlayer, getPlayersInGame } from '../utils/commonRequest'

import express, { type Router } from 'express'
import type { FirebaseSimpPlayer } from '../utils/types'
const router: Router = express.Router()

router.get(
  '/leaveGame',
  rateLimiter,
  celebrate({
    [Segments.QUERY]: Joi.object().keys({
      playerToken: Joi.string().required().min(1).max(250).label('playerToken'),
    }),
  }),
  async (req, res) => {
    const playerToken = req.query.playerToken as string

    if (!(await verifyFCMToken(playerToken))) {
      return res.sendStatus(401)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        const gameId = await getGameId(playerToken, client)
        if (gameId === null) {
          return res.sendStatus(400)
        }

        const players = await getPlayersInGame(gameId, client)

        let gameMaster = await getGameMaster(gameId, client)

        if (gameMaster === playerToken) {
          gameMaster = await handleGameMasterChange(
            gameId,
            gameMaster,
            players,
            client
          )
          if (gameMaster === playerToken) {
            return res.sendStatus(200)
          }
        }

        await deletePlayer(playerToken, client)
        await notifyPlayers(gameId, gameMaster, players)

        // TODO: Fix game state

        return res.sendStatus(200)
      })
      .catch(async (err) => {
        console.log(err.stack)
        return res.sendStatus(500)
      })
      .finally(async () => {
        await client.end()
      })
  }
)

async function getGameId(
  playerToken: string,
  client: Client
): Promise<string | null> {
  const query = 'SELECT game_id FROM Players WHERE token=$1'
  const result = await client.query(query, [playerToken])
  return result.rowCount === 0 ? null : result.rows[0].game_id
}

async function getGameMaster(gameId: string, client: Client): Promise<string> {
  const query = 'SELECT game_master FROM Games WHERE game_id=$1'
  return (await client.query(query, [gameId])).rows[0].game_master
}

async function deleteGame(gameId: string, client: Client) {
  const query = 'DELETE FROM Games WHERE game_id=$1'
  await client.query(query, [gameId])
}

async function changeGameMaster(
  gameId: string,
  newGameMaster: string,
  client: Client
) {
  const query = 'UPDATE Games SET game_master=$1 WHERE game_id=$2'
  const values = [newGameMaster, gameId]
  await client.query(query, values)
}

// This function will handle database side of handling change of game master
// and return new game master token if there are other players, otherwise
// return initial game master token.
async function handleGameMasterChange(
  gameId: string,
  gameMaster: string,
  players: FirebaseSimpPlayer[],
  client: Client
) {
  let newGameMaster = gameMaster
  if (players.length === 1) {
    await deleteGame(gameId, client)
    await deletePlayer(gameMaster, client)
  } else {
    for (let i = 0; newGameMaster === gameMaster; i++) {
      newGameMaster = players[i].token
    }
    await changeGameMaster(gameId, newGameMaster, client)
  }
  return newGameMaster
}

async function notifyPlayers(
  playerToken: string,
  gameMaster: string,
  players: FirebaseSimpPlayer[]
) {
  const message = {
    data: {
      type: 'playerLeft',
      playerHash: sha256(playerToken).toString(),
      gameMaster: sha256(gameMaster).toString(),
    },
    token: '',
  }

  players.forEach(async (player) => {
    message.token = player.token
    await sendFirebaseMessage(message)
  })
}

export default router
