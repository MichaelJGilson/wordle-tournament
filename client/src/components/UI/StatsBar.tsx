import React from 'react';

interface StatsBarProps {
    playersAlive: number;
    yourRank: number;
    yourScore: number;
    killCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
    playersAlive,
    yourRank,
    yourScore,
    killCount
}) => {
    return (
        <div className="game-stats">
            <div className="stat-card">
                <div className="stat-number" id="playersAlive">{playersAlive}</div>
                <div className="stat-label">Players Alive</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" id="yourRank">{yourRank}</div>
                <div className="stat-label">Your Rank</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" id="yourScore">{yourScore}</div>
                <div className="stat-label">Score</div>
            </div>
            <div className="stat-card">
                <div className="stat-number" id="killCount">{killCount}</div>
                <div className="stat-label">Kills</div>
            </div>
        </div>
    );
};
