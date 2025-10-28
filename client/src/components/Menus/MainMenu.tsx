import React from 'react';

interface MainMenuProps {
    onPublicMatch: () => void;
    onCustomGame: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
    onPublicMatch,
    onCustomGame
}) => {
    return (
        <div className="game-setup">
            <h2>Choose Game Mode</h2>
            <div className="button-group" style={{ flexDirection: 'column', gap: '20px' }}>
                <button
                    className="btn"
                    onClick={onPublicMatch}
                    style={{
                        padding: '20px 40px',
                        fontSize: '1.2rem',
                        background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)'
                    }}
                >
                    🔥 Join Public Battle Royale
                    <div style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.9 }}>
                        Tetris 99-style: 100 players, 15 minutes, garbage system
                    </div>
                </button>
                <button
                    className="btn"
                    onClick={onCustomGame}
                    style={{ padding: '20px 40px', fontSize: '1.2rem' }}
                >
                    🏠 Custom Battle Royale
                    <div style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.8 }}>
                        Create or join private battle royale rooms
                    </div>
                </button>
            </div>
        </div>
    );
};
