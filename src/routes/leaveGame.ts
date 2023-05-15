import { getClient } from '../utils/databaseConnection'
import { rateLimiter } from '../utils/rateLimiter'
import { celebrate, Joi, Segments } from 'celebrate'
import { sendFirebaseMessage, verifyFCMToken } from '../utils/firebase'
import sha256 from 'crypto-js/sha256'
import { type Client } from 'pg'
import { deletePlayer, getPlayersInGameTokens } from '../utils/commonRequest'

import express, { type Router } from 'express'
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
    if (!(await verifyFCMToken(req.query.playerToken))) {
      return res.sendStatus(400)
    }

    const client = getClient()
    client
      .connect()
      .then(async () => {
        // We already know that the request value is defined
        const playerToken = req.query.playerToken as string

        const gameId = await getGameId(playerToken, client)
        if (gameId === null) {
          return res.sendStatus(400)
        }

        const players = await getPlayersInGameTokens(gameId, client)

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
  const getGameIdQuery = 'SELECT game_id FROM Players WHERE token=$1'
  const values = [playerToken]
  const getGameIdResult = await client.query(getGameIdQuery, values)
  if (getGameIdResult.rowCount === 0) {
    return null
  } else {
    return getGameIdResult.rows[0].game_id
  }
}

async function getGameMaster(gameId: string, client: Client): Promise<string> {
  const getGameMasterQuery = 'SELECT game_master FROM Games WHERE game_id=$1'
  const values = [gameId]
  return (await client.query(getGameMasterQuery, values)).rows[0].game_master
}

async function deleteGame(gameId: string, client: Client) {
  const deleteGameQuery = 'DELETE FROM Games WHERE game_id=$1'
  const values = [gameId]
  await client.query(deleteGameQuery, values)
}

async function changeGameMaster(
  gameId: string,
  newGameMaster: string,
  client: Client
) {
  const changeGameMasterQuery =
    'UPDATE Games SET game_master=$1 WHERE game_id=$2'
  const values = [newGameMaster, gameId]
  await client.query(changeGameMasterQuery, values)
}

// This function will handle database side of handling change of game master
// and return new game master token if there are other players, otherwise
// return initial game master token.
async function handleGameMasterChange(
  gameId: string,
  gameMaster: string,
  players: Array<{ token: string }>,
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
  players: Array<{ token: string }>
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
