import React, { useState } from 'react';

interface PublicMatchmakingProps {
    onFindMatch: (playerName: string) => void;
    onBack: () => void;
    searching: boolean;
    queueStatus: string;
}

export const PublicMatchmaking: React.FC<PublicMatchmakingProps> = ({
    onFindMatch,
    onBack,
    searching,
    queueStatus
}) => {
    const [playerName, setPlayerName] = useState('');

    const handleSubmit = () => {
        if (playerName.trim()) {
            onFindMatch(playerName.trim());
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && playerName.trim()) {
            handleSubmit();
        }
    };

    return (
        <div className="game-setup">
            <h2>🔥 Public Battle Royale</h2>
            <div
                className="info-card"
                style={{
                    marginBottom: '20px',
                    padding: '20px',
                    background: 'linear-gradient(145deg, #2a2a2c, #1a1a1c)',
                    borderRadius: '12px',
                    border: '1px solid #ff6b6b'
                }}
            >
                <h3 style={{ color: '#ff6b6b', marginBottom: '15px' }}>
                    Battle Royale Rules
                </h3>
                <ul style={{ textAlign: 'left', lineHeight: 1.6, color: '#e0e0e0' }}>
                    <li>
                        <strong>100 players, 15 minutes</strong> - Last player standing wins
                    </li>
                    <li>
                        <strong>Random opponents</strong> - Get matched with different players
                    </li>
                    <li>
                        <strong>Garbage system</strong> - Complete words to send garbage rows to opponents
                    </li>
                    <li>
                        <strong>Instant KO</strong> - First-try completion eliminates opponent immediately
                    </li>
                </ul>
            </div>
            <input
                type="text"
                className="input-field"
                placeholder="Enter your name"
                maxLength={20}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={searching}
            />
            <div className="message info">{queueStatus}</div>
            <div className="button-group">
                <button
                    className="btn"
                    onClick={handleSubmit}
                    disabled={searching || !playerName.trim()}
                    style={{
                        background: searching
                            ? undefined
                            : 'linear-gradient(135deg, #ff6b6b, #ee5a24)'
                    }}
                >
                    {searching ? '⏳ Searching...' : '🔥 Join Battle Royale'}
                </button>
                <button className="btn" onClick={onBack} disabled={searching}>
                    Back
                </button>
            </div>
        </div>
    );
};
