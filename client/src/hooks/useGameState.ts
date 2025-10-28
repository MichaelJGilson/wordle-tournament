import { useState, useCallback } from 'react';
import type { GameState } from '../types/game';

const initialState: GameState = {
    gameId: null,
    playerId: null,
    playerName: '',
    currentGuess: '',
    currentRow: 0,
    gameStatus: 'waiting',
    players: [],
    playersAlive: 0,
    yourRank: 1,
    score: 0,
    killCount: 0,
    connected: false,
    overlayShown: false,
    isBattleRoyale: true,
    currentOpponent: null,
    gameTimer: 0,
    gameTimerFormatted: '15:00',
    garbageRows: 0,
    maxRows: 6,
    totalRows: 6,
    awaitingNewMatch: false,
    publicMatchmaking: false,
};

export function useGameState() {
    const [state, setState] = useState<GameState>(initialState);

    const updateState = useCallback((updates: Partial<GameState>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    const resetState = useCallback(() => {
        setState({ ...initialState, connected: state.connected });
    }, [state.connected]);

    const addLetter = useCallback((letter: string) => {
        setState(prev => {
            // Don't add letter if board is full or player is eliminated
            if (prev.currentGuess.length >= 5 || prev.currentRow >= prev.maxRows) {
                return prev;
            }

            // Check if player is awaiting new match
            if (prev.awaitingNewMatch) {
                console.log('🎯 Blocked input - player awaiting new match');
                return prev;
            }

            return {
                ...prev,
                currentGuess: prev.currentGuess + letter,
            };
        });
    }, []);

    const removeLetter = useCallback(() => {
        setState(prev => {
            if (prev.currentGuess.length === 0) {
                return prev;
            }

            return {
                ...prev,
                currentGuess: prev.currentGuess.slice(0, -1),
            };
        });
    }, []);

    const clearCurrentGuess = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentGuess: '',
        }));
    }, []);

    const advanceRow = useCallback(() => {
        setState(prev => ({
            ...prev,
            currentRow: prev.currentRow + 1,
            currentGuess: '',
        }));
    }, []);

    return {
        state,
        updateState,
        resetState,
        addLetter,
        removeLetter,
        clearCurrentGuess,
        advanceRow,
    };
}
