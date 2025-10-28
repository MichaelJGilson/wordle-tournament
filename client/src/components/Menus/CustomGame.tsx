import React, { useState } from 'react';

interface CustomGameProps {
    onCreateGame: (playerName: string) => void;
    onJoinGame: (gameId: string, playerName: string) => void;
    onBack: () => void;
}

export const CustomGame: React.FC<CustomGameProps> = ({
    onCreateGame,
    onJoinGame,
    onBack
}) => {
    const [playerName, setPlayerName] = useState('');
    const [gameId, setGameId] = useState('');

    const handleCreate = () => {
        if (playerName.trim()) {
            onCreateGame(playerName.trim());
        }
    };

    const handleJoin = () => {
        if (playerName.trim() && gameId.trim()) {
            onJoinGame(gameId.trim().toUpperCase(), playerName.trim());
        }
    };

    return (
        <div className="game-setup">
            <h2>Custom Room</h2>
            <input
                type="text"
                className="input-field"
                placeholder="Enter your name"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
            />
            <input
                type="text"
                className="input-field"
                placeholder="Game ID (optional - leave empty to create new game)"
                maxLength={50}
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
            />
            <div className="button-group">
                <button
                    className="btn"
                    onClick={handleCreate}
                    disabled={!playerName.trim()}
                >
                    Create Room
                </button>
                <button
                    className="btn"
                    onClick={handleJoin}
                    disabled={!playerName.trim() || !gameId.trim()}
                >
                    Join Room
                </button>
                <button className="btn" onClick={onBack}>
                    Back
                </button>
            </div>
        </div>
    );
};
