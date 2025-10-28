import React from 'react';
import type { Player } from '../../types/game';

interface PlayersListProps {
    players: Player[];
    currentPlayerId: string | null;
    maxDisplay?: number;
}

export const PlayersList: React.FC<PlayersListProps> = ({
    players,
    currentPlayerId,
    maxDisplay = 10
}) => {
    const alivePlayers = players.filter(p => p.alive);
    const topPlayers = alivePlayers.slice(0, maxDisplay);

    if (topPlayers.length === 0) {
        return (
            <div className="players-list">
                <h3 className="players-title">Players Remaining</h3>
                <div style={{ textAlign: 'center', padding: '20px', opacity: 0.7 }}>
                    Waiting for players...
                </div>
            </div>
        );
    }

    return (
        <div className="players-list">
            <h3 className="players-title">Players Remaining</h3>
            <div>
                {topPlayers.map((player, index) => (
                    <PlayerItem
                        key={player.id}
                        player={player}
                        rank={index + 1}
                        isCurrentPlayer={player.id === currentPlayerId}
                    />
                ))}
            </div>
        </div>
    );
};

interface PlayerItemProps {
    player: Player;
    rank: number;
    isCurrentPlayer: boolean;
}

const PlayerItem: React.FC<PlayerItemProps> = ({
    player,
    rank,
    isCurrentPlayer
}) => {
    return (
        <div className={`player-item ${isCurrentPlayer ? 'you' : ''}`}>
            <span className="player-name">
                #{rank} {player.name}
                {player.completedCurrentWord && ' ✅'}
            </span>
            <span className="player-score">{player.score || 0}</span>
        </div>
    );
};
