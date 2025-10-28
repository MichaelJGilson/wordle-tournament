import React, { useMemo } from 'react';
import { WordGrid } from './WordGrid';
import { Keyboard } from '../UI/Keyboard';
import { StatsBar } from '../UI/StatsBar';
import { PlayersList } from '../UI/PlayersList';
import { OpponentGrid } from '../UI/OpponentGrid';
import { useClientTimer } from '../../hooks/useClientTimer';
import type { GameState, LetterState, GuessProgress } from '../../types/game';

interface GameBoardProps {
    state: GameState;
    onKeyPress: (key: string) => void;
    onLeaveGame: () => void;
    message: string;
    messageType: 'info' | 'success' | 'error';
}

export const GameBoard: React.FC<GameBoardProps> = ({
    state,
    onKeyPress,
    onLeaveGame,
    message,
    messageType
}) => {
    // Client-side timer that counts down every second
    const { formattedTimer } = useClientTimer({
        serverTimer: state.gameTimer || 0,
        isPlaying: state.gameStatus === 'playing'
    });

    // Calculate letter states for keyboard coloring from guess history
    const letterStates = useMemo(() => {
        const states = new Map<string, LetterState>();

        // Process all guesses to determine letter states
        state.guesses.forEach(guess => {
            guess.guess.split('').forEach((letter, index) => {
                const letterState = guess.result[index];
                const currentState = states.get(letter);

                // Priority: correct > present > absent
                if (letterState === 'correct') {
                    states.set(letter, 'correct');
                } else if (letterState === 'present' && currentState !== 'correct') {
                    states.set(letter, 'present');
                } else if (letterState === 'absent' && !currentState) {
                    states.set(letter, 'absent');
                }
            });
        });

        return states;
    }, [state.guesses]);

    // Format timer display with client-side countdown
    const timerDisplay = state.gameTimer
        ? `🔥 Battle Royale: ${formattedTimer} remaining`
        : '🔥 Battle Royale Active';

    // Use guesses from state (synced from server)
    const guesses: GuessProgress[] = state.guesses;

    // Get opponent info
    const opponentName = typeof state.currentOpponent === 'string'
        ? state.currentOpponent
        : state.currentOpponent?.name || null;

    const opponentProgress = typeof state.currentOpponent === 'object' && state.currentOpponent?.progress
        ? state.currentOpponent.progress
        : [];

    return (
        <div>
            <StatsBar
                playersAlive={state.playersAlive}
                yourRank={state.yourRank}
                yourScore={state.score}
                killCount={state.killCount}
            />

            <div className="timer">{timerDisplay}</div>

            <div className="game-area">
                <div className="wordle-container">
                    <div className={`message ${messageType}`}>{message}</div>

                    <WordGrid
                        guesses={guesses}
                        currentGuess={state.currentGuess}
                        currentRow={state.currentRow}
                        garbageRows={state.garbageRows}
                        maxRows={state.maxRows}
                    />

                    <Keyboard
                        onKeyPress={onKeyPress}
                        letterStates={letterStates}
                    />
                </div>

                <div className="sidebar">
                    <PlayersList
                        players={state.players}
                        currentPlayerId={state.playerId}
                        maxDisplay={10}
                    />

                    <OpponentGrid
                        opponentName={opponentName}
                        opponentProgress={opponentProgress}
                    />

                    <div className="game-controls">
                        <button className="btn" onClick={onLeaveGame}>
                            Leave Game
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
