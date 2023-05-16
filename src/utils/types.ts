export interface FirebasePlayerInfo {
  nickname: string
  playerHash: string
  turn: number
}

export interface FirebaseSimpPlayer {
  nickname: string
  token: string
}

export interface StartGamePlayer {
  token: string
  nickname: string
  card1: string
  card2: string
}

export interface GameLobbyData {
  smallBlind: number
  startingFunds: number
  players: FirebasePlayerInfo[]
  gameMasterHash: string
}

export interface NewGameInfo {
  gameId: number
  startingFunds: number
  smallBlind: number
}

export interface StartingGameInfo {
  players: FirebasePlayerInfo[]
  cards: string[]
}
