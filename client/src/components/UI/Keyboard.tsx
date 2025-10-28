import React from 'react';
import type { LetterState } from '../../types/game';

interface KeyboardProps {
    onKeyPress: (key: string) => void;
    letterStates: Map<string, LetterState>;
}

const keyboardLayout = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

export const Keyboard: React.FC<KeyboardProps> = ({ onKeyPress, letterStates }) => {
    const getKeyClass = (key: string): string => {
        const baseClass = 'key';

        if (key === 'ENTER' || key === 'BACKSPACE') {
            return `${baseClass} wide`;
        }

        const state = letterStates.get(key);
        if (state) {
            return `${baseClass} letter ${state}`;
        }

        return `${baseClass} letter`;
    };

    const getKeyDisplay = (key: string): string => {
        if (key === 'BACKSPACE') return '⌫';
        return key;
    };

    return (
        <div className="keyboard" id="keyboard">
            {keyboardLayout.map((row, rowIndex) => (
                <div key={rowIndex} className="keyboard-row">
                    {row.map(key => (
                        <button
                            key={key}
                            className={getKeyClass(key)}
                            onClick={() => onKeyPress(key)}
                        >
                            {getKeyDisplay(key)}
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
};
