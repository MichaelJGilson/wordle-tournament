import { useEffect } from 'react';

interface UseKeyboardProps {
    onKeyPress: (key: string) => void;
    enabled: boolean;
}

export function useKeyboard({ onKeyPress, enabled }: UseKeyboardProps) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toUpperCase();

            if (key === 'ENTER') {
                event.preventDefault();
                onKeyPress('ENTER');
            } else if (key === 'BACKSPACE') {
                event.preventDefault();
                onKeyPress('BACKSPACE');
            } else if (/^[A-Z]$/.test(key)) {
                event.preventDefault();
                onKeyPress(key);
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onKeyPress, enabled]);
}
