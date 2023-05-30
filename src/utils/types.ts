export interface BasicPlayerInfo {
  nickname: string
  token: string
}

export interface FirebasePlayerInfoWithTurn {
  nickname: string
  playerHash: string
  turn: number
}

export interface FirebasePlayerInfoWIthCards {
  token: string
  nickname: string
  card1: string
  card2: string
}

export interface GameLobbyData {
  smallBlind: number
  startingFunds: number
  players: FirebasePlayerInfoWithTurn[]
  gameMasterHash: string
}

export interface NewGameInfo {
  gameId: number
  startingFunds: number
  smallBlind: number
}

export interface StartingGameInfo {
  players: FirebasePlayerInfoWithTurn[]
  cards: string[]
}

export enum PlayerState {
  Folded = 'fold',
  Raised = 'raise',
  Checked = 'check',
  Called = 'call',
  NoAction = '',
  Won = 'won',
}
