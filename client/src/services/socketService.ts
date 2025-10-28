import { io, Socket } from 'socket.io-client';
import type {
    ServerGameState,
    MatchFoundData,
    QueueStatus,
    CreateGameResponse,
    JoinGameResponse,
    GuessResponse,
} from '../types/game';

class SocketService {
    private socket: Socket | null = null;
    private eventHandlers: Map<string, Function> = new Map();

    connect(): void {
        // Don't reconnect if already connected
        if (this.socket && this.socket.connected) {
            console.log('✅ Already connected to server');
            return;
        }

        // Auto-detect server URL based on environment
        const currentHost = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://';

        let serverUrl: string;
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            serverUrl = 'http://localhost:3000';
        } else if (currentHost.includes('railway.app') || currentHost.includes('up.railway.app')) {
            serverUrl = `${protocol}${currentHost}`;
        } else {
            serverUrl = `${protocol}${currentHost}:3000`;
        }

        console.log('🔌 Attempting to connect to:', serverUrl);

        this.socket = io(serverUrl, {
            autoConnect: true,
            reconnection: true,
            timeout: 10000,
        });

        this.setupDefaultListeners();
    }

    private setupDefaultListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('✅ Connected to server successfully!');
            this.emit('connectionChange', true);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server:', reason);
            this.emit('connectionChange', false);
        });

        this.socket.on('connect_error', (error) => {
            console.error('🔥 Connection error:', error);
            this.emit('connectionChange', false);
        });

        this.socket.on('gameUpdate', (serverGameState: ServerGameState) => {
            console.log('📡 Received game update:', serverGameState);
            this.emit('gameUpdate', serverGameState);
        });

        this.socket.on('queueStatus', (status: QueueStatus) => {
            console.log('📊 Queue status update:', status);
            this.emit('queueStatus', status);
        });

        this.socket.on('matchFound', (matchData: MatchFoundData) => {
            console.log('🎉 Match found:', matchData);
            this.emit('matchFound', matchData);
        });

        this.socket.on('matchError', (errorData: { error: string }) => {
            console.error('❌ Match error:', errorData);
            this.emit('matchError', errorData.error);
        });
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }

    // Event emitter
    on(event: string, handler: Function): void {
        this.eventHandlers.set(event, handler);
    }

    off(event: string): void {
        this.eventHandlers.delete(event);
    }

    private emit(event: string, data?: any): void {
        const handler = this.eventHandlers.get(event);
        if (handler) {
            handler(data);
        }
    }

    // Game actions
    createGame(playerName: string, callback: (response: CreateGameResponse) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        console.log('🎮 Creating game for:', playerName);
        this.socket.emit('createGame', { playerName }, callback);
    }

    joinGame(gameId: string, playerName: string, callback: (response: JoinGameResponse) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        console.log('🎮 Joining game:', gameId);
        this.socket.emit('joinGame', { gameId, playerName }, callback);
    }

    startGame(callback: (response: { success: boolean; error?: string }) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        console.log('🚀 Starting game');
        this.socket.emit('startGame', {}, callback);
    }

    makeGuess(guess: string, callback: (response: GuessResponse) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        this.socket.emit('makeGuess', { guess: guess.toUpperCase() }, callback);
    }

    joinPublicQueue(playerName: string, callback: (response: { success: boolean; error?: string }) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        console.log('🎯 Joining public queue:', playerName);
        this.socket.emit('joinPublicQueue', { playerName }, callback);
    }

    leavePublicQueue(callback: (response: { success: boolean; error?: string }) => void): void {
        if (!this.socket) {
            callback({ success: false, error: 'Not connected to server' });
            return;
        }

        console.log('🚪 Leaving public queue');
        this.socket.emit('leavePublicQueue', {}, callback);
    }

    getQueueStatus(callback: (response: QueueStatus & { success: boolean }) => void): void {
        if (!this.socket) {
            callback({ success: false, inQueue: false });
            return;
        }

        this.socket.emit('getQueueStatus', {}, callback);
    }
}

// Export singleton instance
export const socketService = new SocketService();
