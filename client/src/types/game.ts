// Game Types for Word Royale

export interface Player {
    id: string;
    name: string;
    alive: boolean;
    rank: number | null;
    score: number;
    wordsCompleted?: number;
    playersEliminated?: number;
    completedCurrentWord?: boolean;
    currentMatchScore?: number;
}

export interface GameState {
    gameId: string | null;
    playerId: string | null;
    playerName: string;
    currentGuess: string;
    currentRow: number;
    gameStatus: 'waiting' | 'playing' | 'ended';
    players: Player[];
    playersAlive: number;
    yourRank: number;
    score: number;
    killCount: number;
    connected: boolean;
    overlayShown: boolean;
    isBattleRoyale: boolean;
    currentOpponent: Opponent | null;
    gameTimer?: number;
    gameTimerFormatted?: string;
    garbageRows: number;
    maxRows: number;
    totalRows: number;
    awaitingNewMatch: boolean;
    publicMatchmaking: boolean;
    guesses: GuessProgress[];
}

export interface Opponent {
    id: string;
    name: string;
    progress: GuessProgress[];
}

export interface GuessProgress {
    row: number;
    guess: string;
    result: LetterState[];
}

export type LetterState = 'correct' | 'present' | 'absent' | '';

export interface GuessResult {
    result: LetterState[];
    correct: boolean;
    completed: boolean;
    currentRow: number;
    garbageRows: number;
    pointsEarned?: number;
    totalScore?: number;
    speedBonus?: number;
}

export interface ServerGameState {
    gameId: string;
    status: 'waiting' | 'playing' | 'ended';
    playersAlive: number;
    totalPlayers: number;
    gameTimer: number;
    gameTimerFormatted: string;
    isBattleRoyale: boolean;
    players: Player[];
    playerProgress?: PlayerProgress;
    currentOpponent?: Opponent | string;
    host?: Player;
    isHost?: boolean;
    isPublicMatch?: boolean;
}

export interface PlayerProgress {
    currentRow: number;
    completed: boolean;
    awaitingNewMatch: boolean;
    garbageRows: number;
    maxRows: number;
    totalRows: number;
    guesses: GuessProgress[];
}

export interface MatchFoundData {
    gameId: string;
    playerId: string;
    opponent: string;
    isBattleRoyale?: boolean;
}

export interface QueueStatus {
    inQueue: boolean;
    queuePosition?: number;
    queueSize?: number;
    estimatedWaitTime?: number;
}

export interface CreateGameResponse {
    success: boolean;
    gameId?: string;
    playerId?: string;
    isBattleRoyale?: boolean;
    error?: string;
}

export interface JoinGameResponse {
    success: boolean;
    playerId?: string;
    error?: string;
}

export interface GuessResponse {
    success: boolean;
    evaluation?: GuessResult;
    error?: string;
}

export interface EliminationData {
    rank: number;
    score: number;
    wordsCompleted: number;
    playersEliminated: number;
}

export interface VictoryData {
    score: number;
    wordsCompleted: number;
    playersEliminated: number;
}
