import React from 'react';
import type { GuessProgress } from '../../types/game';

interface OpponentGridProps {
    opponentName: string | null;
    opponentProgress: GuessProgress[];
}

export const OpponentGrid: React.FC<OpponentGridProps> = ({
    opponentName,
    opponentProgress
}) => {
    const renderCell = (rowIndex: number, colIndex: number) => {
        const guess = opponentProgress.find(g => g.row === rowIndex);
        const state = guess?.result[colIndex] || '';

        const classNames = [
            'opponent-cell',
            state && state
        ].filter(Boolean).join(' ');

        return (
            <div
                key={`opponent-${rowIndex}-${colIndex}`}
                className={classNames}
            />
        );
    };

    return (
        <div className="opponent-section">
            <h3 className="players-title">
                {opponentName ? `Opponent: ${opponentName}` : 'Searching for opponent...'}
            </h3>
            <div className="opponent-grid" id="opponentGrid">
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <div key={`opponent-row-${rowIndex}`} className="opponent-row">
                        {Array.from({ length: 5 }).map((_, colIndex) =>
                            renderCell(rowIndex, colIndex)
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
