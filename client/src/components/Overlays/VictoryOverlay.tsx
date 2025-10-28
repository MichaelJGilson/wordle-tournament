import React from 'react';
import type { VictoryData } from '../../types/game';

interface VictoryOverlayProps {
    data: VictoryData;
    onPlayAgain: () => void;
    onSpectate: () => void;
    show: boolean;
}

export const VictoryOverlay: React.FC<VictoryOverlayProps> = ({
    data,
    onPlayAgain,
    onSpectate,
    show
}) => {
    return (
        <div className={`result-overlay ${show ? 'show' : ''}`}>
            <div className="result-content">
                <div className="result-title victory">VICTORY!</div>
                <div
                    className="result-rank"
                    style={{
                        background: 'linear-gradient(145deg, #ffd700, #ffed4e)',
                        color: '#000'
                    }}
                >
                    #1 WINNER
                </div>
                <div className="result-stats">
                    <div className="result-stat">
                        <span className="result-stat-label">Final Score</span>
                        <span className="result-stat-value">{data.score}</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-label">Words Completed</span>
                        <span className="result-stat-value">{data.wordsCompleted}</span>
                    </div>
                    <div className="result-stat">
                        <span className="result-stat-label">Players Eliminated</span>
                        <span className="result-stat-value">{data.playersEliminated}</span>
                    </div>
                </div>
                <div className="result-actions">
                    <button className="result-btn primary" onClick={onPlayAgain}>
                        Play Again
                    </button>
                    <button className="result-btn secondary" onClick={onSpectate}>
                        Spectate
                    </button>
                </div>
            </div>
        </div>
    );
};
