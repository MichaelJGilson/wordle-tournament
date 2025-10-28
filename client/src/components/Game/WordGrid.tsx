import React, { useState, useEffect } from 'react';
import { LetterCell } from './LetterCell';
import type { GuessProgress } from '../../types/game';

interface WordGridProps {
    guesses: GuessProgress[];
    currentGuess: string;
    currentRow: number;
    garbageRows: number;
    maxRows: number;
}

export const WordGrid: React.FC<WordGridProps> = ({
    guesses,
    currentGuess,
    currentRow,
    garbageRows,
    maxRows
}) => {
    // Track the last guess count to detect new guesses
    const [lastGuessCount, setLastGuessCount] = useState(0);
    const [animateRow, setAnimateRow] = useState<number | null>(null);

    useEffect(() => {
        if (guesses.length > lastGuessCount) {
            // New guess was added - animate the most recent one
            const newestGuess = guesses[guesses.length - 1];
            setAnimateRow(newestGuess.row);
            setLastGuessCount(guesses.length);

            // Clear animation flag after animation completes
            const timer = setTimeout(() => setAnimateRow(null), 700);
            return () => clearTimeout(timer);
        }
    }, [guesses.length, lastGuessCount]);

    // Render garbage rows at the top
    const renderGarbageRows = () => {
        return Array.from({ length: garbageRows }).map((_, rowIndex) => (
            <div key={`garbage-${rowIndex}`} className="word-row garbage-row">
                {Array.from({ length: 5 }).map((_, colIndex) => (
                    <LetterCell
                        key={`garbage-${rowIndex}-${colIndex}`}
                        letter=""
                        state=""
                        isGarbage={true}
                    />
                ))}
            </div>
        ));
    };

    // Render playable rows
    const renderPlayableRows = () => {
        return Array.from({ length: maxRows }).map((_, rowIndex) => {
            const isCurrentRow = rowIndex === currentRow;
            const guess = guesses.find(g => g.row === rowIndex);

            return (
                <div key={`row-${rowIndex}`} className="word-row">
                    {Array.from({ length: 5 }).map((_, colIndex) => {
                        let letter = '';
                        let state: any = '';

                        if (isCurrentRow && currentGuess) {
                            // Current row being typed
                            letter = currentGuess[colIndex] || '';
                        } else if (guess) {
                            // Previously guessed row
                            letter = guess.guess[colIndex] || '';
                            state = guess.result[colIndex] || '';
                        }

                        return (
                            <LetterCell
                                key={`${rowIndex}-${colIndex}`}
                                letter={letter}
                                state={state}
                                animate={rowIndex === animateRow && letter !== '' && state !== ''}
                            />
                        );
                    })}
                </div>
            );
        });
    };

    return (
        <div className="word-grid" id="wordGrid">
            {renderGarbageRows()}
            {renderPlayableRows()}
        </div>
    );
};
