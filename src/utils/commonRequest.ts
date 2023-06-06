import { type PoolClient } from 'pg'
import { type BasicPlayerInfo, PlayerState } from './types'
import { Hand } from 'pokersolver'
import { convertCardName } from './randomise'
import { sendFirebaseMessageToEveryone } from './firebase'
import sha256 from 'crypto-js/sha256'

export const STARTING_FUNDS_DEFAULT = 1000
export const SMALL_BLIND_DEFAULT = 100
export const MAX_PLAYERS = 8
export const TURN_DEFAULT = -1

export async function createPlayer(
  playerInfo: BasicPlayerInfo,
  gameId: string | null,
  client: PoolClient
) {
  const query = `INSERT INTO Players(token, nickname, turn, 
            game_id, card1, card2, funds, bet) 
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)`
  const values = [
    playerInfo.token,
    playerInfo.nickname,
    0,
    gameId,
    null,
    null,
    null,
    null,
  ]
  await client.query(query, values)
}

export async function isPlayerInAnyGame(
  playerToken: string,
  client: PoolClient
): Promise<boolean> {
  const query = 'SELECT 1 FROM Players WHERE token=$1'
  return (await client.query(query, [playerToken])).rowCount !== 0
}

export async function isPlayerInGame(
  playerToken: string,
  gameId: string,
  client: PoolClient
): Promise<boolean> {
  const query = 'SELECT 1 FROM Players WHERE token=$1 AND game_id=$2'
  return (await client.query(query, [playerToken, gameId])).rowCount !== 0
}

export async function isPlayersTurn(
  playerToken: string,
  gameId: string,
  client: PoolClient
): Promise<boolean> {
  const query = 'SELECT 1 FROM Games WHERE game_id=$1 AND current_player=$2'
  return (await client.query(query, [gameId, playerToken])).rowCount !== 0
}

export async function deletePlayer(playerToken: string, client: PoolClient) {
  const query = 'DELETE FROM Players WHERE token=$1'
  await client.query(query, [playerToken])
}

export async function setPlayerState(
  playerToken: string,
  client: PoolClient,
  state: string
) {
  const query = 'UPDATE Players SET last_action=$1 WHERE token=$2'
  await client.query(query, [state, playerToken])
}

export async function getPlayerState(
  playerToken: string,
  client: PoolClient
): Promise<string> {
  const query = 'SELECT last_action FROM Players WHERE token=$1'
  return (await client.query(query, [playerToken])).rows[0].last_action
}

export async function changeCurrentPlayer(
  oldPlayerToken: string,
  gameId: string,
  client: PoolClient
) {
  const getOldPlayerTurn = 'SELECT turn FROM Players WHERE token=$1'

  const getPlayersAndTurn =
    'SELECT token, turn, last_action FROM Players WHERE game_id=$1 AND (last_action IS NULL OR last_action<>$2) ORDER BY turn ASC'

  const oldTurn = await (
    await client.query(getOldPlayerTurn, [oldPlayerToken])
  ).rows[0].turn
  const playersTurns = await client.query(getPlayersAndTurn, [
    gameId,
    PlayerState.Folded,
  ])
  if (playersTurns.rowCount <= 1) {
    return ''
  } else {
    for (let i = 0; i < playersTurns.rowCount; i++) {
      if (playersTurns.rows[i].turn > oldTurn) {
        await setCurrentPlayer(gameId, playersTurns.rows[i].token, client)
        return playersTurns.rows[i].token
      }
    }

    await setCurrentPlayer(gameId, playersTurns.rows[0].token, client)

    return playersTurns.rows[0].token
  }
}

export async function getRound(
  gameId: string,
  client: PoolClient
): Promise<number> {
  const query = 'SELECT game_round FROM Games WHERE game_id=$1'
  return parseInt((await client.query(query, [gameId])).rows[0].game_round)
}

export async function sendNewCards(
  gameId: string,
  round: number,
  client: PoolClient
) {
  if (round < 2 || round > 4) {
    return
  }

  const getCardsQuery =
    'SELECT card1, card2, card3, card4, card5 FROM Games WHERE game_id=$1'
  const cards = await client.query(getCardsQuery, [gameId])
  const cardsToSend: string[] = []

  if (round === 3) {
    cardsToSend.push(cards.rows[0].card4)
  } else if (round === 4) {
    cardsToSend.push(cards.rows[0].card5)
  } else {
    cardsToSend.push(cards.rows[0].card1)
    cardsToSend.push(cards.rows[0].card2)
    cardsToSend.push(cards.rows[0].card3)
  }

  const message = {
    data: {
      type: 'newCards',
      round: round.toString(),
      cards: JSON.stringify(cardsToSend),
    },
    token: '',
  }

  await sendFirebaseMessageToEveryone(message, gameId, client)
}

export async function gameEnd(gameId: string, client: PoolClient) {
  const getPaymentQuery =
    'SELECT current_table_value FROM Games WHERE game_id=$1'
  const endGamePlayersQuery = 'DELETE FROM Players WHERE game_id=$1'
  const endGameGameQuery = 'DELETE FROM Games WHERE game_id=$1'
  const payment: number = +(await client.query(getPaymentQuery, [gameId]))
    .rows[0].current_table_value
  const winners = await calculateWinner(gameId, client)
  for (let i = 0; i < winners.length; i++) {
    winners[i] = sha256(winners[i])
  }

  const message = {
    data: {
      type: 'gameEnd',
      winner: JSON.stringify(winners),
      payment: (payment / winners.length).toString(),
    },
    token: '',
  }

  await sendFirebaseMessageToEveryone(message, gameId, client)
  await client.query(endGameGameQuery, [gameId])
  await client.query(endGamePlayersQuery, [gameId])
}

export async function changeGameRoundIfNeeded(
  gameId: string,
  client: PoolClient
): Promise<boolean> {
  // The next round commences only if there is one active player OR when current player was the last raiser
  const maxBet = await getMaxBet(gameId, client)
  const shouldAnyPlayerStillMove = `SELECT 1 FROM Players
     WHERE game_id=$1
       AND (last_action IS NULL OR (bet<>$2 AND last_action<>$3))`
  const updateGameRound =
    'UPDATE Games SET game_round=game_round + 1 WHERE game_id=$1'
  const resetPlayerStates =
    'UPDATE Players SET last_action=NULL WHERE game_id=$1 AND last_action<>$2'

  if (
    (
      await client.query(shouldAnyPlayerStillMove, [
        gameId,
        maxBet,
        PlayerState.Folded,
      ])
    ).rowCount === 0
  ) {
    const startingPlayer = await chooseRoundStartingPlayer(gameId, client)

    await client.query(updateGameRound, [gameId])
    const round: number = await getRound(gameId, client)
    if (round === 6) {
      await gameEnd(gameId, client)
    } else {
      await client.query(resetPlayerStates, [gameId, PlayerState.Folded])
      await setCurrentPlayer(gameId, startingPlayer, client)

      await sendNewCards(gameId, round, client)
    }

    return true
  } else {
    return false
  }
}

export async function chooseRoundStartingPlayer(
  gameId: string,
  client: PoolClient
): Promise<string> {
  const players = await getPlayersStillInGame(gameId, client)
  const bigBlindTurn = await getMaxTurn(gameId, client)
  players.sort((a, b) => b.turn - a.turn)

  // If small blind or big blind is still in game, they start the round.
  const smallBlindIndex = players.findIndex(
    (player) => parseInt(player.turn) === bigBlindTurn - 1
  )
  const isSmallBlindInGame = smallBlindIndex !== -1

  const bigBlindIndex = players.findIndex(
    (player) => parseInt(player.turn) === bigBlindTurn
  )
  const isBigBlindInGame = bigBlindIndex !== -1

  if (isSmallBlindInGame) {
    return players[smallBlindIndex].token
  } else if (isBigBlindInGame) {
    return players[bigBlindIndex].token
  } else {
    return players[players.length - 1].token
  }
}

export async function getMaxTurn(gameId: string, client: PoolClient) {
  const query = 'SELECT MAX(turn) as mt FROM Players WHERE game_id=$1'
  return parseInt((await client.query(query, [gameId])).rows[0].mt)
}

export async function setCurrentPlayer(
  gameId: string,
  playerToken: string,
  client: PoolClient
) {
  const query = 'UPDATE games SET current_player=$1 WHERE game_id=$2'
  const values = [playerToken, gameId]
  await client.query(query, values)
}

export async function getPlayersInGame(
  gameId: string,
  client: PoolClient
): Promise<BasicPlayerInfo[]> {
  const query =
    'SELECT token, nickname FROM Players WHERE game_id=$1 ORDER BY turn ASC'
  return (await client.query(query, [gameId])).rows
}

export async function getGameIdStatus(
  gameMaster: string,
  client: PoolClient
): Promise<{ gameId: string | null; started: boolean }> {
  const query = 'SELECT game_id, current_player FROM Games WHERE game_master=$1'
  const result = await client.query(query, [gameMaster])
  let gameId = null
  let currentPlayer = null
  if (result.rowCount !== 0) {
    gameId = result.rows[0].game_id
    currentPlayer = result.rows[0].current_player
  }
  return { gameId, started: currentPlayer !== null }
}

export async function getSmallBlindToken(
  gameId: string,
  playerSize: number,
  client: PoolClient
): Promise<string> {
  const getSmallBlind = 'SELECT token FROM Players WHERE game_id=$1 AND turn=$2'
  return (await client.query(getSmallBlind, [gameId, playerSize - 2])).rows[0]
    .token
}

export async function getBigBlindToken(
  gameId: string,
  playerSize: number,
  client: PoolClient
): Promise<string> {
  const getBigBlind = 'SELECT token FROM Players WHERE game_id=$1 AND turn=$2'
  return (await client.query(getBigBlind, [gameId, playerSize - 1])).rows[0]
    .token
}

export async function getSmallBlindValue(
  gameId: string,
  client: PoolClient
): Promise<string> {
  const query = 'SELECT small_blind FROM Games WHERE game_id=$1'
  return (await client.query(query, [gameId])).rows[0].small_blind
}

export async function getRemainingPlayersCards(
  gameId: string,
  client: PoolClient
) {
  const query =
    'SELECT token, nickname, card1, card2 FROM Players WHERE game_id=$1 AND (last_action <> $2 OR last_action IS NULL)'
  const values = [gameId, PlayerState.Folded]
  return (await client.query(query, values)).rows
}

export async function getGameCards(gameId: string, client: PoolClient) {
  const query =
    'SELECT card1, card2, card3, card4, card5 FROM games WHERE game_id=$1'
  const queryResult = await client.query(query, [gameId])
  const cards: string[] = []
  Object.entries(queryResult.rows[0]).forEach(([key, value]) => {
    cards.push(convertCardName(value as string))
  })
  return cards
}

export async function calculateWinner(gameId: string, client: PoolClient) {
  const playersWithCards = await getRemainingPlayersCards(gameId, client)
  if (playersWithCards.length === 1) {
    const result: any[] = []
    result.push(playersWithCards[0].token)
    return result
  }
  const gameCards = await getGameCards(gameId, client)
  const playersHands: any[] = []

  playersWithCards.forEach((player) => {
    playersHands.push(
      Hand.solve([
        convertCardName(player.card1),
        convertCardName(player.card2),
        ...gameCards,
      ])
    )
  })

  const solution: any[] = Hand.winners(playersHands)
  const winners: any[] = []
  for (let i = 0; i < playersHands.length; i++) {
    if (solution.includes(playersHands[i])) {
      winners.push(playersWithCards[i].token)
    }
  }
  return winners
}
export async function playerCanBetAmount(
  gameId: string,
  playerToken: string,
  amount: string,
  client: PoolClient
): Promise<boolean> {
  const smallBlindValue = await getSmallBlindValue(gameId, client)
  const playerSize = (await getPlayersInGame(gameId, client)).length
  const smallBlind = await getSmallBlindToken(gameId, playerSize, client)
  const smallBlindState = await getPlayerState(smallBlind, client)
  const bigBlind = await getBigBlindToken(gameId, playerSize, client)
  const bigBlindState = await getPlayerState(bigBlind, client)

  if (playerToken === smallBlind && smallBlindState == null) {
    amount = (+amount - +smallBlindValue).toString()
  } else if (playerToken === bigBlind && bigBlindState == null) {
    amount = (+amount - +smallBlindValue * 2).toString()
  }

  const query = 'SELECT 1 FROM Players WHERE token=$1 AND funds>=$2'
  return (await client.query(query, [playerToken, amount])).rowCount !== 0
}

export async function isAmountRaise(
  gameId: string,
  amount: string,
  client: PoolClient
) {
  const getMaxBet = 'SELECT MAX(bet) as max FROM Players WHERE game_id=$1'
  return (await (await client.query(getMaxBet, [gameId])).rows[0].max) < amount
}

export async function handlePlayerRaised(
  gameId: string,
  playerToken: string,
  amount: string,
  client: PoolClient
) {
  const getOldBet = 'SELECT bet FROM Players WHERE token=$1'
  const setNewBet =
    'UPDATE Players SET funds=funds+bet-$1, bet=$1 WHERE token=$2'
  const putMoneyToTable =
    'UPDATE Games SET current_table_value=current_table_value+$1 WHERE game_id=$2'

  const oldBet: number = (await client.query(getOldBet, [playerToken])).rows[0]
    .bet
  await client.query(setNewBet, [amount, playerToken])
  await client.query(putMoneyToTable, [parseInt(amount) - oldBet, gameId])
}

export async function getMaxBet(
  gameId: string,
  client: PoolClient
): Promise<string> {
  const query = 'SELECT MAX(bet) as max FROM Players WHERE game_id=$1'
  return (await client.query(query, [gameId])).rows[0].max
}

export async function getPlayersStillInGame(
  gameId: string,
  client
): Promise<any[]> {
  const query = `SELECT token, turn
  FROM players
  WHERE game_id = $1 AND (last_action <> $2 OR last_action IS NULL)`
  const values = [gameId, PlayerState.Folded]
  return (await client.query(query, values)).rows
}
