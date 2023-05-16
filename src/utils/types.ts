export interface PlayerInfo {
  nickname: string
  playerHash: string
}

export interface InternalPlayerInfo {
  token: string
  card1: string
  card2: string
}

export interface PlayerGameInfo {
  playerHash: string
  turn: number
}

export interface GameSettings {
  smallBlind: number
  startingFunds: number
  players: PlayerInfo[]
  gameMasterHash: string
}

export interface NewGameInfo {
  gameId: number
  startingFunds: number
  smallBlind: number
}

export interface StartingGameInfo {
  players: PlayerGameInfo[]
  cards: string[]
}

export interface SimpPlayer {
  nickname: string
  token: string
}
