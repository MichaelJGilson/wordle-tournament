import React, { useState, useCallback } from 'react';
import { useGameState } from './hooks/useGameState';
import { useSocket } from './hooks/useSocket';
import { useKeyboard } from './hooks/useKeyboard';
import { MainMenu } from './components/Menus/MainMenu';
import { PublicMatchmaking } from './components/Menus/PublicMatchmaking';
import { CustomGame } from './components/Menus/CustomGame';
import { GameLobby } from './components/Menus/GameLobby';
import { GameBoard } from './components/Game/GameBoard';
import { EliminationOverlay } from './components/Overlays/EliminationOverlay';
import { VictoryOverlay } from './components/Overlays/VictoryOverlay';
import type { ServerGameState, MatchFoundData, QueueStatus, EliminationData, VictoryData } from './types/game';

type Screen = 'main-menu' | 'public-matchmaking' | 'custom-game' | 'lobby' | 'game';

export const App: React.FC = () => {
    const { state, updateState, addLetter, removeLetter, clearCurrentGuess } = useGameState();
    const [currentScreen, setCurrentScreen] = useState<Screen>('main-menu');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
    const [queueStatus, setQueueStatus] = useState('Ready to join the Battle Royale!');
    const [searching, setSearching] = useState(false);
    const [eliminationData, setEliminationData] = useState<EliminationData | null>(null);
    const [victoryData, setVictoryData] = useState<VictoryData | null>(null);

    // Socket event handlers
    const handleConnectionChange = useCallback((connected: boolean) => {
        updateState({ connected });
    }, [updateState]);

    const handleGameUpdate = useCallback((serverState: ServerGameState) => {
        updateState({
            gameStatus: serverState.status,
            playersAlive: serverState.playersAlive,
            players: serverState.players,
            gameTimer: serverState.gameTimer,
        });

        if (serverState.status === 'waiting') setCurrentScreen('lobby');
        else if (serverState.status === 'playing') setCurrentScreen('game');
    }, [updateState]);

    const handleMatchFound = useCallback((matchData: MatchFoundData) => {
        updateState({
            gameId: matchData.gameId,
            playerId: matchData.playerId,
        });
        setSearching(false);
        setCurrentScreen('game');
    }, [updateState]);

    const handleQueueStatus = useCallback((status: QueueStatus) => {
        if (status.inQueue) {
            setQueueStatus(`In queue: Position ${status.queuePosition}`);
        }
    }, []);

    const handleMatchError = useCallback((error: string) => {
        setMessage(error);
        setMessageType('error');
        setSearching(false);
    }, []);

    const socket = useSocket({
        onConnectionChange: handleConnectionChange,
        onGameUpdate: handleGameUpdate,
        onMatchFound: handleMatchFound,
        onQueueStatus: handleQueueStatus,
        onMatchError: handleMatchError,
    });

    const handleKeyPress = useCallback((key: string) => {
        if (state.gameStatus !== 'playing') return;

        if (key === 'ENTER' && state.currentGuess.length === 5) {
            socket.makeGuess(state.currentGuess).then((response) => {
                if (response.success) clearCurrentGuess();
                else setMessage(response.error || 'Invalid word');
            });
        } else if (key === 'BACKSPACE') {
            removeLetter();
        } else if (/^[A-Z]$/.test(key)) {
            addLetter(key);
        }
    }, [state, socket, addLetter, removeLetter, clearCurrentGuess]);

    useKeyboard({
        onKeyPress: handleKeyPress,
        enabled: currentScreen === 'game',
    });

    return (
        <div className="container">
            <div className="header">
                <h1 className="title">WORD ROYALE</h1>
                <div className={`connection-status ${state.connected ? 'connected' : 'disconnected'}`}>
                    {state.connected ? 'Connected' : 'Disconnected'}
                </div>
            </div>

            {currentScreen === 'main-menu' && (
                <MainMenu
                    onPublicMatch={() => setCurrentScreen('public-matchmaking')}
                    onCustomGame={() => setCurrentScreen('custom-game')}
                />
            )}

            {currentScreen === 'public-matchmaking' && (
                <PublicMatchmaking
                    onFindMatch={async (name) => {
                        setSearching(true);
                        updateState({ playerName: name });
                        await socket.joinPublicQueue(name);
                    }}
                    onBack={() => setCurrentScreen('main-menu')}
                    searching={searching}
                    queueStatus={queueStatus}
                />
            )}

            {currentScreen === 'custom-game' && (
                <CustomGame
                    onCreateGame={async (name) => {
                        const res = await socket.createGame(name);
                        if (res.success) {
                            updateState({ gameId: res.gameId || null, playerId: res.playerId || null });
                            setCurrentScreen('lobby');
                        }
                    }}
                    onJoinGame={async (gameId, name) => {
                        const res = await socket.joinGame(gameId, name);
                        if (res.success) {
                            updateState({ gameId, playerId: res.playerId || null });
                            setCurrentScreen('lobby');
                        }
                    }}
                    onBack={() => setCurrentScreen('main-menu')}
                />
            )}

            {currentScreen === 'lobby' && state.gameId && (
                <GameLobby
                    gameId={state.gameId}
                    players={state.players}
                    currentPlayerId={state.playerId}
                    isHost={false}
                    canStart={state.players.length >= 2}
                    onStartGame={() => socket.startGame()}
                    onLeaveGame={() => setCurrentScreen('main-menu')}
                />
            )}

            {currentScreen === 'game' && (
                <GameBoard
                    state={state}
                    onKeyPress={handleKeyPress}
                    onLeaveGame={() => setCurrentScreen('main-menu')}
                    message={message}
                    messageType={messageType}
                />
            )}

            {eliminationData && (
                <EliminationOverlay
                    data={eliminationData}
                    onPlayAgain={() => setCurrentScreen('main-menu')}
                    onSpectate={() => setEliminationData(null)}
                    show={!!eliminationData}
                />
            )}

            {victoryData && (
                <VictoryOverlay
                    data={victoryData}
                    onPlayAgain={() => setCurrentScreen('main-menu')}
                    onSpectate={() => setVictoryData(null)}
                    show={!!victoryData}
                />
            )}
        </div>
    );
};

export default App;
