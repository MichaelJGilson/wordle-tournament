import React from 'react';
import type { EliminationData } from '../../types/game';

interface EliminationOverlayProps {
    data: EliminationData;
    onPlayAgain: () => void;
    onSpectate: () => void;
    show: boolean;
}

export const EliminationOverlay: React.FC<EliminationOverlayProps> = ({
    data,
    onPlayAgain,
    onSpectate,
    show
}) => {
    return (
        <div className={`result-overlay ${show ? 'show' : ''}`}>
            <div className="result-content">
                <div className="result-title eliminated">ELIMINATED</div>
                <div className="result-rank">#{data.rank}</div>
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
