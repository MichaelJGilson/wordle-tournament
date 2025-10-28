import React from 'react';
import type { Player } from '../../types/game';

interface GameLobbyProps {
    gameId: string;
    players: Player[];
    currentPlayerId: string | null;
    isHost: boolean;
    canStart: boolean;
    onStartGame: () => void;
    onLeaveGame: () => void;
}

export const GameLobby: React.FC<GameLobbyProps> = ({
    gameId,
    players,
    currentPlayerId,
    isHost,
    canStart,
    onStartGame,
    onLeaveGame
}) => {
    const copyGameId = () => {
        navigator.clipboard.writeText(gameId).then(() => {
            // Could show a toast notification here
            console.log('Game ID copied:', gameId);
        });
    };

    return (
        <div className="game-setup">
            <h2>Game Lobby</h2>
            <div className="game-id-container">
                <span>Game ID:</span>
                <span className="game-id-text">{gameId}</span>
                <button className="copy-btn" onClick={copyGameId}>
                    📋 Copy
                </button>
            </div>
            <p>Players: {players.length}/100</p>
            <div
                style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginBottom: '20px'
                }}
            >
                {players.slice(0, 10).map((player) => (
                    <div
                        key={player.id}
                        style={{
                            padding: '8px',
                            margin: '4px 0',
                            background: player.id === currentPlayerId ? '#538d4e' : '#3a3a3c',
                            borderRadius: '8px',
                            textAlign: 'center'
                        }}
                    >
                        {player.name}
                        {player.id === currentPlayerId && ' (You)'}
                    </div>
                ))}
            </div>
            <div className="button-group">
                {isHost && (
                    <button
                        className="btn"
                        onClick={onStartGame}
                        disabled={!canStart}
                    >
                        {canStart ? 'Start Game' : 'Need 2+ Players to Start'}
                    </button>
                )}
                <button className="btn" onClick={onLeaveGame}>
                    Leave Game
                </button>
            </div>
        </div>
    );
};
