import React, { useEffect, useState } from 'react';
import type { LetterState } from '../../types/game';

interface LetterCellProps {
    letter: string;
    state: LetterState;
    animate?: boolean;
    isGarbage?: boolean;
}

export const LetterCell: React.FC<LetterCellProps> = ({
    letter,
    state,
    animate = false,
    isGarbage = false
}) => {
    const [isFlipping, setIsFlipping] = useState(false);

    useEffect(() => {
        if (animate && state) {
            setIsFlipping(true);
            const timer = setTimeout(() => setIsFlipping(false), 600);
            return () => clearTimeout(timer);
        }
    }, [animate, state]);

    const classNames = [
        'letter-cell',
        letter && !isGarbage && 'filled',
        state && state,
        isFlipping && 'flipping',
        isGarbage && 'garbage'
    ].filter(Boolean).join(' ');

    return (
        <div className={classNames}>
            {!isGarbage && letter}
        </div>
    );
};
