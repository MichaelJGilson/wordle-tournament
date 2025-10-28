import { useEffect, useCallback } from 'react';
import { socketService } from '../services/socketService';
import type { ServerGameState, MatchFoundData, QueueStatus } from '../types/game';

interface UseSocketProps {
    onConnectionChange: (connected: boolean) => void;
    onGameUpdate: (serverState: ServerGameState) => void;
    onMatchFound: (matchData: MatchFoundData) => void;
    onQueueStatus: (status: QueueStatus) => void;
    onMatchError: (error: string) => void;
}

export function useSocket({
    onConnectionChange,
    onGameUpdate,
    onMatchFound,
    onQueueStatus,
    onMatchError,
}: UseSocketProps) {
    // Connect to socket on mount (only once)
    useEffect(() => {
        socketService.connect();

        // Cleanup on unmount - only disconnect when component truly unmounts
        return () => {
            socketService.disconnect();
        };
    }, []); // Empty dependency array - only run once on mount

    // Update event handlers when they change (without reconnecting)
    useEffect(() => {
        socketService.on('connectionChange', onConnectionChange);
        socketService.on('gameUpdate', onGameUpdate);
        socketService.on('matchFound', onMatchFound);
        socketService.on('queueStatus', onQueueStatus);
        socketService.on('matchError', onMatchError);

        // Don't disconnect on cleanup, just remove handlers
        return () => {
            socketService.off('connectionChange');
            socketService.off('gameUpdate');
            socketService.off('matchFound');
            socketService.off('queueStatus');
            socketService.off('matchError');
        };
    }, [onConnectionChange, onGameUpdate, onMatchFound, onQueueStatus, onMatchError]);

    // Game actions wrapped in callbacks
    const createGame = useCallback((playerName: string) => {
        return new Promise<{ success: boolean; gameId?: string; playerId?: string; error?: string }>((resolve) => {
            socketService.createGame(playerName, resolve);
        });
    }, []);

    const joinGame = useCallback((gameId: string, playerName: string) => {
        return new Promise<{ success: boolean; playerId?: string; error?: string }>((resolve) => {
            socketService.joinGame(gameId, playerName, resolve);
        });
    }, []);

    const startGame = useCallback(() => {
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
            socketService.startGame(resolve);
        });
    }, []);

    const makeGuess = useCallback((guess: string) => {
        return new Promise<{ success: boolean; evaluation?: any; error?: string }>((resolve) => {
            socketService.makeGuess(guess, resolve);
        });
    }, []);

    const joinPublicQueue = useCallback((playerName: string) => {
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
            socketService.joinPublicQueue(playerName, resolve);
        });
    }, []);

    const leavePublicQueue = useCallback(() => {
        return new Promise<{ success: boolean; error?: string }>((resolve) => {
            socketService.leavePublicQueue(resolve);
        });
    }, []);

    const isConnected = useCallback(() => {
        return socketService.isConnected();
    }, []);

    return {
        createGame,
        joinGame,
        startGame,
        makeGuess,
        joinPublicQueue,
        leavePublicQueue,
        isConnected,
    };
}
