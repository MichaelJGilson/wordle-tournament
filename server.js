const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// Generate short, user-friendly game IDs
function generateShortId(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Database setup
const db = new sqlite3.Database('./wordle_battle.db');

// Initialize database tables
db.serialize(() => {
    // Games table
    db.run(`CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'waiting',
        current_word TEXT,
        round_number INTEGER DEFAULT 1,
        players_alive INTEGER DEFAULT 0,
        max_players INTEGER DEFAULT 100,
        timer INTEGER DEFAULT 120,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        ended_at DATETIME
    )`);

    // Players table
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        game_id TEXT,
        name TEXT NOT NULL,
        socket_id TEXT,
        score INTEGER DEFAULT 0,
        current_guess TEXT DEFAULT '',
        current_row INTEGER DEFAULT 0,
        alive BOOLEAN DEFAULT 1,
        rank INTEGER,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games (id)
    )`);

    // Game guesses table for tracking player progress
    db.run(`CREATE TABLE IF NOT EXISTS game_guesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT,
        player_id TEXT,
        word TEXT,
        guess TEXT,
        row_number INTEGER,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (player_id) REFERENCES players (id)
    )`);

    // Tournament matches table for 1v1 pairings
    db.run(`CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        game_id TEXT,
        round_number INTEGER,
        player1_id TEXT,
        player2_id TEXT,
        word TEXT,
        winner_id TEXT,
        status TEXT DEFAULT 'active',
        timer INTEGER DEFAULT 90,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (game_id) REFERENCES games (id),
        FOREIGN KEY (player1_id) REFERENCES players (id),
        FOREIGN KEY (player2_id) REFERENCES players (id),
        FOREIGN KEY (winner_id) REFERENCES players (id)
    )`);

    // Match progress table for tracking player progress in matches
    db.run(`CREATE TABLE IF NOT EXISTS match_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id TEXT,
        player_id TEXT,
        guess TEXT,
        row_number INTEGER,
        result TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches (id),
        FOREIGN KEY (player_id) REFERENCES players (id)
    )`);
});

// Load word lists
let ANSWER_WORDS = [];
let VALID_WORDS = [];

function loadWordLists() {
    try {
        // Load answer words
        const answerText = fs.readFileSync('./wordle-answers-alphabetical.txt', 'utf8');
        ANSWER_WORDS = answerText.trim().split('\n').map(word => word.trim().toUpperCase());
        
        // Load valid guess words
        const validText = fs.readFileSync('./wordle-allowed-guesses.txt', 'utf8');
        const validGuesses = validText.trim().split('\n').map(word => word.trim().toUpperCase());
        
        // Combine for complete validation
        const allValidWords = new Set([...ANSWER_WORDS, ...validGuesses]);
        VALID_WORDS = Array.from(allValidWords);
        
        console.log(`Loaded ${ANSWER_WORDS.length} answer words and ${VALID_WORDS.length} total valid words`);
    } catch (error) {
        console.error('Error loading word lists:', error);
        // Fallback words
        ANSWER_WORDS = ['APPLE', 'BREAD', 'CHAIR', 'DANCE', 'EARTH'];
        VALID_WORDS = [...ANSWER_WORDS];
    }
}

loadWordLists();

// Game state management
const activeGames = new Map();
const playerSockets = new Map();

// Public matchmaking queue
const publicMatchmakingQueue = [];
let publicMatchmakingInterval = null;
let publicBattleRoyaleGame = null; // Persistent Battle Royale game

// Public matchmaking functions
function startPublicMatchmaking() {
    if (publicMatchmakingInterval) return;
    
    publicMatchmakingInterval = setInterval(() => {
        processPublicMatchmakingQueue();
    }, 2000); // Check every 2 seconds
    
    console.log('🔄 Public matchmaking started');
}

function stopPublicMatchmaking() {
    if (publicMatchmakingInterval) {
        clearInterval(publicMatchmakingInterval);
        publicMatchmakingInterval = null;
        console.log('⏹️ Public matchmaking stopped');
    }
}

function addToPublicQueue(socket, playerName) {
    // Remove any existing entries for this socket
    removeFromPublicQueue(socket.id);
    
    const queueEntry = {
        socketId: socket.id,
        playerName: playerName,
        joinedAt: Date.now()
    };
    
    publicMatchmakingQueue.push(queueEntry);
    console.log(`➕ Player ${playerName} (${socket.id}) added to public queue. Queue size: ${publicMatchmakingQueue.length}`);
    
    // Start matchmaking if not already running
    startPublicMatchmaking();
    
    // Notify player of queue status
    socket.emit('queueStatus', {
        inQueue: true,
        queuePosition: publicMatchmakingQueue.length,
        queueSize: publicMatchmakingQueue.length,
        estimatedWaitTime: Math.max(0, Math.ceil((publicMatchmakingQueue.length - 1) / 2) * 3) // rough estimate in seconds
    });
    
    return queueEntry;
}

function removeFromPublicQueue(socketId) {
    const index = publicMatchmakingQueue.findIndex(entry => entry.socketId === socketId);
    if (index !== -1) {
        const removed = publicMatchmakingQueue.splice(index, 1)[0];
        console.log(`➖ Player ${removed.playerName} (${socketId}) removed from public queue. Queue size: ${publicMatchmakingQueue.length}`);
        
        // Update queue positions for remaining players
        updateQueuePositions();
        
        // Stop matchmaking if queue is empty
        if (publicMatchmakingQueue.length === 0) {
            stopPublicMatchmaking();
        }
        
        return removed;
    }
    return null;
}

function updateQueuePositions() {
    publicMatchmakingQueue.forEach((entry, index) => {
        const socket = io.sockets.sockets.get(entry.socketId);
        if (socket) {
            socket.emit('queueStatus', {
                inQueue: true,
                queuePosition: index + 1,
                queueSize: publicMatchmakingQueue.length,
                estimatedWaitTime: Math.max(0, Math.ceil(index / 2) * 3)
            });
        }
    });
}

function processPublicMatchmakingQueue() {
    if (publicMatchmakingQueue.length === 0) {
        return; // No players waiting
    }
    
    // Create or get the current public battle royale game
    if (!publicBattleRoyaleGame || publicBattleRoyaleGame.status === 'ended') {
        // Create new battle royale game
        const gameId = generateShortId(6);
        publicBattleRoyaleGame = new BattleRoyaleGame(gameId, 100);
        publicBattleRoyaleGame.isPublicMatch = true;
        activeGames.set(gameId, publicBattleRoyaleGame);
        console.log(`🔥 Created new public Battle Royale: ${gameId}`);
    }
    
    // Add all waiting players to the battle royale
    while (publicMatchmakingQueue.length > 0) {
        const playerEntry = publicMatchmakingQueue.shift();
        const socket = io.sockets.sockets.get(playerEntry.socketId);
        
        // Validate socket still exists
        if (!socket) {
            console.log(`⚠️ Player ${playerEntry.playerName} disconnected, skipping`);
            continue;
        }
        
        // Check if player is already in a game
        const existingPlayer = playerSockets.get(socket.id);
        if (existingPlayer) {
            console.log(`⚠️ Player ${playerEntry.playerName} already in game, skipping`);
            continue;
        }
        
        try {
            // Add player to the battle royale
            socket.join(publicBattleRoyaleGame.id);
            const result = publicBattleRoyaleGame.addPlayer(socket.id, playerEntry.playerName);
            
            if (result.success) {
                // Track player in global map
                playerSockets.set(socket.id, { 
                    gameId: publicBattleRoyaleGame.id, 
                    playerId: result.playerId, 
                    name: playerEntry.playerName 
                });
                
                // Notify player they joined the battle royale
                socket.emit('matchFound', {
                    gameId: publicBattleRoyaleGame.id,
                    playerId: result.playerId,
                    isBattleRoyale: true
                });
                
                console.log(`✅ ${playerEntry.playerName} joined Battle Royale (${publicBattleRoyaleGame.players.size} players)`);
                
                // Auto-start when we reach minimum players
                if (publicBattleRoyaleGame.players.size >= 2 && publicBattleRoyaleGame.status === 'waiting') {
                    setTimeout(() => {
                        if (publicBattleRoyaleGame.status === 'waiting') {
                            console.log(`🚀 Auto-starting Battle Royale with ${publicBattleRoyaleGame.players.size} players`);
                            const startResult = publicBattleRoyaleGame.startGame(publicBattleRoyaleGame.hostId);
                            
                            if (startResult.success) {
                                // Broadcast to all players (Battle Royale handles individual updates internally)
                                publicBattleRoyaleGame.broadcastGameState();
                                console.log(`✅ Battle Royale started successfully`);
                            } else {
                                console.log(`❌ Failed to start Battle Royale: ${startResult.error}`);
                            }
                        }
                    }, 3000); // 3 second delay to allow more players to join
                }
            } else {
                console.log(`❌ Failed to add ${playerEntry.playerName} to Battle Royale: ${result.error}`);
                socket.emit('matchError', { error: result.error });
            }
        } catch (error) {
            console.error(`❌ Error adding player ${playerEntry.playerName}:`, error);
            socket.emit('matchError', { error: 'Failed to join Battle Royale' });
        }
    }
    
    // Update queue positions for any remaining players
    updateQueuePositions();
}

function cleanupFailedMatch(gameId, socket1, socket2) {
    try {
        // Remove from active games
        if (gameId && activeGames.has(gameId)) {
            activeGames.delete(gameId);
            console.log(`🧹 Cleaned up failed game: ${gameId}`);
        }
        
        // Remove from player tracking
        if (socket1 && socket1.id) {
            playerSockets.delete(socket1.id);
            socket1.leave(gameId);
            socket1.emit('matchError', { error: 'Match creation failed. Please try again.' });
        }
        
        if (socket2 && socket2.id) {
            playerSockets.delete(socket2.id);
            socket2.leave(gameId);
            socket2.emit('matchError', { error: 'Match creation failed. Please try again.' });
        }
    } catch (cleanupError) {
        console.error('❌ Error during match cleanup:', cleanupError);
    }
}




// Battle Royale Game class for Tetris 99-style gameplay
class BattleRoyaleGame {
    constructor(id, maxPlayers = 100) {
        this.id = id;
        this.status = 'waiting'; // waiting, playing, ended
        this.players = new Map(); // playerId -> player object
        this.activeMatches = new Map(); // playerId -> opponent playerId
        this.playerProgress = new Map(); // playerId -> progress object
        this.garbageQueue = new Map(); // playerId -> array of garbage rows
        this.maxPlayers = maxPlayers;
        this.gameTimer = 15 * 60; // 15 minutes in seconds
        this.timerInterval = null;
        this.hostId = null;
        this.isBattleRoyale = true;
        
        // Save to database
        db.run(`INSERT INTO games (id, max_players) VALUES (?, ?)`, [id, maxPlayers]);
        
        console.log(`🎮 Created Battle Royale game: ${id} (max ${maxPlayers} players, 15min timer)`);
    }
    
    addPlayer(socketId, name) {
        if (this.status !== 'waiting') {
            return { success: false, error: 'Game already in progress' };
        }
        
        if (this.players.size >= this.maxPlayers) {
            return { success: false, error: 'Game is full' };
        }
        
        const playerId = generateShortId(8);
        const player = {
            id: playerId,
            name: name,
            socketId: socketId,
            alive: true,
            rank: null,
            joinTime: Date.now(),
            score: 0, // Battle Royale score tracking
            wordsCompleted: 0, // Number of words successfully guessed
            playersEliminated: 0 // Number of players eliminated by this player's garbage
        };
        
        this.players.set(playerId, player);
        
        // Set first player as host
        if (!this.hostId) {
            this.hostId = playerId;
        }
        
        // Initialize player progress
        this.playerProgress.set(playerId, {
            currentRow: 0,
            guesses: [],
            completed: false,
            currentWord: '', // Will be assigned when matched with opponent
            garbageRows: 0, // Number of garbage rows blocking them
            lastActivity: Date.now()
        });
        
        // Initialize garbage queue
        this.garbageQueue.set(playerId, []);
        
        // Track in global map
        playerSockets.set(socketId, { gameId: this.id, playerId: playerId, name: name });
        
        // Save to database
        db.run(`INSERT INTO players (id, game_id, name, socket_id, alive) VALUES (?, ?, ?, ?, 1)`,
            [playerId, this.id, name, socketId]);
        
        console.log(`👤 Player ${name} (${playerId}) joined Battle Royale game ${this.id}`);
        
        return { success: true, playerId: playerId, player: player, isHost: playerId === this.hostId };
    }
    
    startGame(requestingPlayerId = null) {
        if (this.status !== 'waiting') {
            return { success: false, error: 'Game already started or ended' };
        }
        
        if (this.players.size < 2) {
            return { success: false, error: 'At least 2 players required to start battle royale' };
        }
        
        // For public matches, allow auto-start. For custom games, only host can start
        if (!this.isPublicMatch && requestingPlayerId !== this.hostId) {
            return { success: false, error: 'Only the host can start the game' };
        }
        
        this.status = 'playing';
        
        // Start the global game timer
        this.startGameTimer();
        
        // Assign initial random opponents
        this.assignRandomOpponents();
        
        console.log(`🎮 Battle Royale game ${this.id} started with ${this.players.size} players`);
        
        return { success: true };
    }
    
    startGameTimer() {
        this.timerInterval = setInterval(() => {
            this.gameTimer--;
            
            if (this.gameTimer <= 0) {
                this.endGame();
            }
            
            // Broadcast timer update every 10 seconds
            if (this.gameTimer % 10 === 0) {
                this.broadcastGameState();
            }
        }, 1000);
    }
    
    assignRandomOpponents() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        
        // Clear existing matches
        this.activeMatches.clear();
        
        // Shuffle players and pair them up
        const shuffled = [...alivePlayers].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < shuffled.length - 1; i += 2) {
            const player1 = shuffled[i];
            const player2 = shuffled[i + 1];
            
            this.activeMatches.set(player1.id, player2.id);
            this.activeMatches.set(player2.id, player1.id);
            
            // Assign the SAME word to both opponents
            const sharedWord = this.getRandomWord();
            const progress1 = this.playerProgress.get(player1.id);
            const progress2 = this.playerProgress.get(player2.id);
            
            if (progress1) progress1.currentWord = sharedWord;
            if (progress2) progress2.currentWord = sharedWord;
            
            console.log(`🆚 Matched ${player1.name} vs ${player2.name} - shared word: ${sharedWord}`);
        }
        
        // If odd number, last player gets a bye (temporary until someone finishes)
        if (shuffled.length % 2 === 1) {
            const lastPlayer = shuffled[shuffled.length - 1];
            const progress = this.playerProgress.get(lastPlayer.id);
            if (progress) progress.currentWord = this.getRandomWord();
            console.log(`⏳ ${lastPlayer.name} waiting for next opponent - word: ${progress?.currentWord}`);
        }
    }
    
    getRandomWord() {
        return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
    }
    
    makeGuess(playerId, guess) {
        if (this.status !== 'playing') {
            return { success: false, error: 'Game not in progress' };
        }
        
        const player = this.players.get(playerId);
        if (!player || !player.alive) {
            return { success: false, error: 'Player not found or eliminated' };
        }
        
        const progress = this.playerProgress.get(playerId);
        if (!progress || progress.completed) {
            return { success: false, error: 'Invalid player progress' };
        }
        
        // Calculate available rows (total rows minus garbage rows)
        const totalRows = 6;
        const availableRows = Math.max(1, totalRows - (progress.garbageRows || 0));
        
        // Check if player has exceeded available rows
        if (progress.currentRow >= availableRows) {
            console.log(`🚫 ${player.name} attempted guess but board is full: row ${progress.currentRow} >= available ${availableRows}`);
            return { success: false, error: 'No space available for more guesses' };
        }
        
        const target = progress.currentWord;
        const result = this.evaluateGuess(guess, target);
        
        progress.guesses.push({
            guess: guess,
            result: result,
            row: progress.currentRow
        });
        
        progress.currentRow++;
        progress.lastActivity = Date.now();
        
        const isCorrect = guess === target;
        
        if (isCorrect) {
            progress.completed = true;
            
            // Award points for completing word
            const baseScore = 100; // Base points for completing a word
            const speedBonus = Math.max(0, (7 - progress.currentRow) * 25); // Bonus for speed (25 pts per attempt saved)
            const wordScore = baseScore + speedBonus;
            
            player.score += wordScore;
            player.wordsCompleted += 1;
            
            // Calculate garbage rows to send (6 - attempts used)
            const garbageRows = 6 - progress.currentRow;
            
            // Send garbage to opponent
            const opponentId = this.activeMatches.get(playerId);
            if (opponentId) {
                const opponent = this.players.get(opponentId);
                const opponentProgress = this.playerProgress.get(opponentId);
                
                console.log(`🎯 ${player.name} completed word "${target}" in ${progress.currentRow} attempts (+${wordScore} pts)`);
                console.log(`🎯 Opponent: ${opponent?.name}, their word: ${opponentProgress?.currentWord}`);
                
                if (garbageRows > 0) {
                    this.sendGarbage(opponentId, garbageRows, progress.currentRow === 1, playerId);
                }
            } else {
                console.log(`⚠️ ${player.name} completed word but has no opponent to send garbage to`);
            }
            
            // Give player a new word (opponent keeps their word)
            this.resetPlayerForNewRound(playerId);
            
            console.log(`✅ ${player.name} completed word in ${progress.currentRow} attempts, +${wordScore} pts (total: ${player.score}), sent ${garbageRows} garbage`);
        }
        
        // Check if player failed (garbage blocks reduce available attempts)
        const garbageRows = this.garbageQueue.get(playerId)?.length || 0;
        const maxAttempts = Math.max(1, 6 - garbageRows); // Garbage reduces attempts, minimum 1
        
        console.log(`🎮 ${player.name}: Row ${progress.currentRow}, Max attempts: ${maxAttempts}, Garbage blocking: ${garbageRows}`);
        
        if (progress.currentRow >= maxAttempts && !isCorrect) {
            console.log(`💀 ${player.name} eliminated - used all ${maxAttempts} attempts (${garbageRows} garbage rows blocking)`);
            // Find who sent the garbage that eliminated this player (their current opponent likely)
            const opponentId = this.activeMatches.get(playerId);
            this.eliminatePlayer(playerId, opponentId);
        }
        
        // Include score information when word is completed
        const responseData = {
            success: true,
            result: result,
            correct: isCorrect,
            completed: progress.completed,
            currentRow: progress.currentRow,
            garbageRows: this.garbageQueue.get(playerId)?.length || 0
        };
        
        // Add scoring info if word was completed correctly
        if (isCorrect) {
            const baseScore = 100;
            const speedBonus = Math.max(0, (7 - progress.currentRow) * 25);
            const wordScore = baseScore + speedBonus;
            
            responseData.pointsEarned = wordScore;
            responseData.totalScore = player.score;
            responseData.speedBonus = speedBonus;
        }
        
        return responseData;
    }
    
    sendGarbage(targetPlayerId, garbageCount, isInstantKO = false, senderId = null) {
        const targetPlayer = this.players.get(targetPlayerId);
        if (!targetPlayer) {
            console.log(`❌ Cannot send garbage - target player ${targetPlayerId} not found`);
            return;
        }
        
        if (isInstantKO) {
            // First-try completion = instant KO
            this.eliminatePlayer(targetPlayerId, senderId);
            console.log(`💀 ${targetPlayer.name} instantly eliminated!`);
            return;
        }
        
        const garbageQueue = this.garbageQueue.get(targetPlayerId) || [];
        const previousGarbageCount = garbageQueue.length;
        
        // Add garbage rows
        for (let i = 0; i < garbageCount; i++) {
            garbageQueue.push({ type: 'garbage', timestamp: Date.now() });
        }
        
        this.garbageQueue.set(targetPlayerId, garbageQueue);
        
        console.log(`🗑️ Sent ${garbageCount} garbage rows to ${targetPlayer.name}`);
        console.log(`🗑️ ${targetPlayer.name} now has ${garbageQueue.length} total garbage rows (was ${previousGarbageCount})`);
    }
    
    resetPlayerForNewRound(playerId) {
        const progress = this.playerProgress.get(playerId);
        if (progress) {
            progress.currentRow = 0;
            progress.guesses = [];
            progress.completed = false;
            progress.currentWord = this.getRandomWord();
            
            console.log(`🔄 ${this.players.get(playerId)?.name} got new word: ${progress.currentWord}`);
        }
        
        // In Battle Royale, find a new opponent to avoid feedback loops
        this.findNewOpponentAfterWordCompletion(playerId);
    }
    
    findNewOpponent(playerId) {
        const player = this.players.get(playerId);
        
        // Ensure the requesting player is still alive
        if (!player || !player.alive) {
            console.log(`🚫 Cannot find opponent for eliminated player: ${playerId}`);
            return;
        }
        
        const alivePlayers = Array.from(this.players.values())
            .filter(p => p.alive && p.id !== playerId && !this.activeMatches.has(p.id));
        
        if (alivePlayers.length > 0) {
            const newOpponent = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            
            this.activeMatches.set(playerId, newOpponent.id);
            this.activeMatches.set(newOpponent.id, playerId);
            
            console.log(`🔄 ${this.players.get(playerId).name} rematched with ${newOpponent.name}`);
        }
    }
    
    findNewOpponentAfterWordCompletion(playerId) {
        const player = this.players.get(playerId);
        
        // Ensure the requesting player is still alive
        if (!player || !player.alive) {
            console.log(`🚫 Cannot find opponent for eliminated player: ${playerId}`);
            return;
        }
        
        const playerName = player.name;
        const currentOpponentId = this.activeMatches.get(playerId);
        
        // Remove current match to avoid feedback loops
        if (currentOpponentId) {
            this.activeMatches.delete(playerId);
            this.activeMatches.delete(currentOpponentId);
            console.log(`🔄 ${playerName} disconnected from ${this.players.get(currentOpponentId)?.name}`);
        }
        
        // Find all alive players except this one, preferring players who also just completed words
        const alivePlayers = Array.from(this.players.values())
            .filter(p => p.alive && p.id !== playerId);
        
        if (alivePlayers.length > 0) {
            // Prefer players who are also unmatched (just finished words)
            let availablePlayers = alivePlayers.filter(p => !this.activeMatches.has(p.id));
            
            // If no unmatched players, allow taking players from existing matches
            if (availablePlayers.length === 0) {
                availablePlayers = alivePlayers;
            }
            
            const newOpponent = availablePlayers[Math.floor(Math.random() * availablePlayers.length)];
            
            // If the new opponent was already matched, break their old match
            const oldOpponentId = this.activeMatches.get(newOpponent.id);
            if (oldOpponentId) {
                this.activeMatches.delete(newOpponent.id);
                this.activeMatches.delete(oldOpponentId);
                console.log(`🔄 Broke match between ${newOpponent.name} and ${this.players.get(oldOpponentId)?.name}`);
            }
            
            // Create new match
            this.activeMatches.set(playerId, newOpponent.id);
            this.activeMatches.set(newOpponent.id, playerId);
            
            console.log(`🎯 ${playerName} rematched with ${newOpponent.name} after word completion`);
        } else {
            console.log(`⚠️ No opponents available for ${playerName} after word completion`);
        }
    }
    
    eliminatePlayer(playerId, eliminatorId = null) {
        const player = this.players.get(playerId);
        if (player) {
            player.alive = false;
            player.rank = this.getAlivePlayersCount() + 1;
            
            // Award elimination points to the player who caused this elimination
            if (eliminatorId) {
                const eliminator = this.players.get(eliminatorId);
                if (eliminator && eliminator.alive) {
                    const eliminationPoints = 50;
                    eliminator.score += eliminationPoints;
                    eliminator.playersEliminated += 1;
                    console.log(`🎯 ${eliminator.name} eliminated ${player.name} (+${eliminationPoints} pts)`);
                }
            }
            
            // Award placement bonus based on rank (higher rank = better placement = more points)
            const totalPlayers = this.players.size;
            const placementBonus = Math.max(0, Math.floor((totalPlayers - player.rank) * 10));
            player.score += placementBonus;
            
            // Remove from active matches
            const opponentId = this.activeMatches.get(playerId);
            if (opponentId) {
                this.activeMatches.delete(playerId);
                this.activeMatches.delete(opponentId);
                
                // Find new opponent for the remaining player
                this.findNewOpponent(opponentId);
            }
            
            // Update database
            db.run(`UPDATE players SET alive = 0, rank = ? WHERE id = ?`, [player.rank, playerId]);
            
            console.log(`💀 ${player.name} eliminated (Rank: #${player.rank}) +${placementBonus} placement bonus (Final score: ${player.score})`);
            
            // Check if game should end
            this.checkGameEnd();
        }
    }
    
    getAlivePlayersCount() {
        return Array.from(this.players.values()).filter(p => p.alive).length;
    }
    
    checkGameEnd() {
        const aliveCount = this.getAlivePlayersCount();
        
        if (aliveCount <= 1) {
            this.endGame();
        }
    }
    
    endGame() {
        if (this.status === 'ended') return;
        
        this.status = 'ended';
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Set final rankings
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        alivePlayers.forEach((player, index) => {
            player.rank = index + 1;
            db.run(`UPDATE players SET rank = ? WHERE id = ?`, [player.rank, player.id]);
        });
        
        console.log(`🏁 Battle Royale game ${this.id} ended`);
        
        this.broadcastGameState();
    }
    
    removePlayer(socketId) {
        // Find player by socketId
        let playerToRemove = null;
        let playerIdToRemove = null;
        
        for (const [playerId, player] of this.players.entries()) {
            if (player.socketId === socketId) {
                playerToRemove = player;
                playerIdToRemove = playerId;
                break;
            }
        }
        
        if (!playerToRemove) {
            console.log(`⚠️ Player with socketId ${socketId} not found in Battle Royale game ${this.id}`);
            return;
        }
        
        console.log(`🚪 Removing player ${playerToRemove.name} (${playerIdToRemove}) from Battle Royale game ${this.id}`);
        
        // If game is still waiting, just remove the player
        if (this.status === 'waiting') {
            this.players.delete(playerIdToRemove);
            this.playerProgress.delete(playerIdToRemove);
            this.garbageQueue.delete(playerIdToRemove);
            playerSockets.delete(socketId);
            
            console.log(`✅ Player removed during waiting phase, ${this.players.size} players remaining`);
            return;
        }
        
        // If game is in progress, eliminate the player if they're still alive
        if (this.status === 'playing' && playerToRemove.alive) {
            console.log(`💀 Player ${playerToRemove.name} disconnected and will be eliminated`);
            this.eliminatePlayer(playerIdToRemove);
        }
        
        // Clean up tracking
        playerSockets.delete(socketId);
        
        // Remove from active matches
        const opponentId = this.activeMatches.get(playerIdToRemove);
        if (opponentId) {
            this.activeMatches.delete(playerIdToRemove);
            this.activeMatches.delete(opponentId);
            
            // Find new opponent for the remaining player if game is still active
            if (this.status === 'playing') {
                this.findNewOpponent(opponentId);
            }
        }
        
        console.log(`✅ Player cleanup complete`);
    }
    
    evaluateGuess(guess, target) {
        const result = [];
        const targetLetters = target.split('');
        const guessLetters = guess.split('');
        const usedPositions = new Set();
        
        // First pass: check for correct positions (green)
        for (let i = 0; i < 5; i++) {
            if (guessLetters[i] === targetLetters[i]) {
                result[i] = 'correct';
                usedPositions.add(i);
            }
        }
        
        // Second pass: check for wrong positions (yellow)
        for (let i = 0; i < 5; i++) {
            if (result[i] !== 'correct') {
                const letter = guessLetters[i];
                let found = false;
                
                for (let j = 0; j < 5; j++) {
                    if (!usedPositions.has(j) && targetLetters[j] === letter) {
                        result[i] = 'present';
                        usedPositions.add(j);
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    result[i] = 'absent';
                }
            }
        }
        
        return result;
    }
    
    broadcastGameState() {
        console.log(`🔄 Broadcasting Battle Royale game state to ${this.players.size} players`);
        // Send personalized game state to each player
        Array.from(this.players.values()).forEach(player => {
            const personalizedState = this.getGameStateForPlayer(player.id);
            console.log(`📡 Sending state to ${player.name} (${player.id}):`, {
                status: personalizedState.status,
                gameTimer: personalizedState.gameTimer,
                isBattleRoyale: personalizedState.isBattleRoyale,
                playersAlive: personalizedState.playersAlive,
                players: personalizedState.players ? `${personalizedState.players.length} players` : 'no players',
                currentOpponent: personalizedState.currentOpponent ? 
                    (typeof personalizedState.currentOpponent === 'string' ? personalizedState.currentOpponent : personalizedState.currentOpponent.name) 
                    : 'none'
            });
            const socket = io.sockets.sockets.get(player.socketId);
            if (socket) {
                try {
                    socket.emit('gameUpdate', personalizedState);
                } catch (error) {
                    console.error(`❌ Error sending game update to ${player.name} (${player.id}):`, error.message);
                }
            } else {
                console.warn(`⚠️ Socket not found for player ${player.name} (${player.id}, socketId: ${player.socketId})`);
            }
        });
    }
    
    getGameStateForPlayer(playerId) {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        
        // Include ALL players (alive and eliminated) so client can check status
        const allPlayers = Array.from(this.players.values()).map((player, index) => ({
            id: player.id,
            name: player.name,
            alive: player.alive,
            rank: player.alive ? (alivePlayers.findIndex(p => p.id === player.id) + 1) : player.rank
        }));

        const gameState = {
            gameId: this.id,
            status: this.status,
            playersAlive: alivePlayers.length,
            totalPlayers: this.players.size,
            gameTimer: this.gameTimer,
            gameTimerFormatted: this.formatTime(this.gameTimer),
            isBattleRoyale: true,
            players: allPlayers
        };
        
        // Add requesting player's specific information
        const progress = this.playerProgress.get(playerId);
        const opponentId = this.activeMatches.get(playerId);
        const opponent = opponentId ? this.players.get(opponentId) : null;
        const garbageCount = this.garbageQueue.get(playerId)?.length || 0;
        
        gameState.playerProgress = {
            currentRow: progress?.currentRow || 0,
            completed: progress?.completed || false,
            garbageRows: garbageCount,
            maxRows: Math.max(1, 6 - garbageCount), // Playable rows
            totalRows: 6 // Always 6 total visual rows
        };
        
        // Only send opponent data if opponent is still alive
        if (opponent && opponent.alive) {
            const opponentProgress = this.playerProgress.get(opponentId);
            gameState.currentOpponent = {
                id: opponent.id,
                name: opponent.name,
                progress: opponentProgress?.guesses.map(g => ({
                    row: g.row,
                    result: g.result
                })) || []
            };
        }
        
        return gameState;
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);

    // Create or join game
    socket.on('createGame', (data, callback) => {
        console.log(`🎮 CreateGame request from ${socket.id}:`, data);
        
        try {
            const { playerName, maxPlayers = 100 } = data;
            
            if (!playerName || playerName.trim().length === 0) {
                console.log(`❌ Invalid player name: "${playerName}"`);
                callback({ success: false, error: 'Player name is required' });
                return;
            }
            
            const gameId = generateShortId(6); // Generate 6-character game ID
            const game = new BattleRoyaleGame(gameId, maxPlayers);
            
            activeGames.set(gameId, game);
            socket.join(gameId);
            
            const result = game.addPlayer(socket.id, playerName);
            console.log(`🎯 AddPlayer result:`, result);
            
            if (result.success) {
                console.log(`✅ Battle Royale game created! GameID: ${gameId}, PlayerID: ${result.playerId}`);
                callback({ success: true, gameId: gameId, playerId: result.playerId, isBattleRoyale: true });
                game.broadcastGameState();
            } else {
                console.log(`❌ Failed to add player:`, result.error);
                callback({ success: false, error: result.error });
            }
        } catch (error) {
            console.error(`🔥 Error in createGame:`, error);
            callback({ success: false, error: 'Server error occurred' });
        }
    });


    socket.on('joinGame', (data, callback) => {
        const { gameId, playerName } = data;
        const game = activeGames.get(gameId);
        
        if (!game) {
            callback({ success: false, error: 'Game not found' });
            return;
        }

        if (game.status !== 'waiting') {
            callback({ success: false, error: 'Game already started' });
            return;
        }

        socket.join(gameId);
        const result = game.addPlayer(socket.id, playerName);
        
        if (result.success) {
            callback({ success: true, playerId: result.playerId });
            game.broadcastGameState();
        } else {
            callback({ success: false, error: result.error });
        }
    });

    socket.on('startGame', (data, callback) => {
        const playerInfo = playerSockets.get(socket.id);
        if (!playerInfo) {
            callback({ success: false, error: 'Not in a game' });
            return;
        }

        const game = activeGames.get(playerInfo.gameId);
        if (!game) {
            callback({ success: false, error: 'Game not found' });
            return;
        }

        const result = game.startGame(playerInfo.playerId);
        callback(result);
        
        if (result.success) {
            game.broadcastGameState();
        }
    });

    socket.on('makeGuess', (data, callback) => {
        const { guess } = data;
        const playerInfo = playerSockets.get(socket.id);
        
        if (!playerInfo) {
            callback({ success: false, error: 'Not in a game' });
            return;
        }

        const game = activeGames.get(playerInfo.gameId);
        const player = game?.players.get(playerInfo.playerId);
        
        if (!game || !player || !player.alive) {
            callback({ success: false, error: 'Invalid game state' });
            return;
        }

        // Check if word is valid (both game types use same validation)
        if (!VALID_WORDS.includes(guess.toUpperCase())) {
            callback({ success: false, error: 'Invalid word' });
            return;
        }

        let result;
        
        if (game.isBattleRoyale) {
            // Battle Royale mode
            result = game.makeGuess(playerInfo.playerId, guess.toUpperCase());
            
            if (result.success) {
                callback({ 
                    success: true, 
                    evaluation: { 
                        result: result.result,
                        correct: result.correct,
                        completed: result.completed,
                        currentRow: result.currentRow,
                        garbageRows: result.garbageRows
                    }
                });
                
                // Broadcast updated state to all players
                game.broadcastGameState();
            } else {
                callback({ success: false, error: result.error });
            }
        }
    });

    // Public matchmaking handlers
    socket.on('joinPublicQueue', (data, callback) => {
        try {
            const { playerName } = data;
            
            if (!playerName || playerName.trim().length === 0) {
                callback({ success: false, error: 'Player name is required' });
                return;
            }
            
            // Make sure player isn't already in a game
            const existingPlayerInfo = playerSockets.get(socket.id);
            if (existingPlayerInfo) {
                callback({ success: false, error: 'Already in a game or queue' });
                return;
            }
            
            const queueEntry = addToPublicQueue(socket, playerName.trim());
            callback({ 
                success: true, 
                queuePosition: publicMatchmakingQueue.length,
                message: 'Added to public matchmaking queue' 
            });
            
            console.log(`🎯 ${playerName} joined public queue`);
            
        } catch (error) {
            console.error('Error in joinPublicQueue:', error);
            callback({ success: false, error: 'Server error occurred' });
        }
    });

    socket.on('leavePublicQueue', (data, callback) => {
        try {
            const removed = removeFromPublicQueue(socket.id);
            
            if (removed) {
                socket.emit('queueStatus', { inQueue: false });
                callback({ success: true, message: 'Removed from queue' });
                console.log(`🚪 ${removed.playerName} left public queue`);
            } else {
                callback({ success: false, error: 'Not in queue' });
            }
            
        } catch (error) {
            console.error('Error in leavePublicQueue:', error);
            callback({ success: false, error: 'Server error occurred' });
        }
    });

    socket.on('getQueueStatus', (data, callback) => {
        try {
            const queueIndex = publicMatchmakingQueue.findIndex(entry => entry.socketId === socket.id);
            
            if (queueIndex !== -1) {
                callback({
                    success: true,
                    inQueue: true,
                    queuePosition: queueIndex + 1,
                    queueSize: publicMatchmakingQueue.length,
                    estimatedWaitTime: Math.max(0, Math.ceil(queueIndex / 2) * 3)
                });
            } else {
                callback({
                    success: true,
                    inQueue: false,
                    queuePosition: 0,
                    queueSize: publicMatchmakingQueue.length
                });
            }
            
        } catch (error) {
            console.error('Error in getQueueStatus:', error);
            callback({ success: false, error: 'Server error occurred' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Remove from public queue if in queue
        removeFromPublicQueue(socket.id);
        
        const playerInfo = playerSockets.get(socket.id);
        if (playerInfo) {
            const game = activeGames.get(playerInfo.gameId);
            if (game) {
                game.removePlayer(socket.id);
                game.broadcastGameState();
            }
        }
    });
});

// Serve the main game page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'wordle_battle_royale_fixed.html'));
});

// API routes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        activeGames: activeGames.size,
        connectedPlayers: playerSockets.size
    });
});

app.get('/api/games', (req, res) => {
    const games = Array.from(activeGames.values()).map(game => ({
        id: game.id,
        status: game.status,
        playerCount: game.players.size,
        maxPlayers: game.maxPlayers,
        round: game.round
    }));
    res.json(games);
});

app.get('/api/game/:gameId', (req, res) => {
    const game = activeGames.get(req.params.gameId);
    if (!game) {
        return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game.getGameState());
});

app.get('/api/public/queue', (req, res) => {
    res.json({
        queueSize: publicMatchmakingQueue.length,
        isMatchmakingActive: publicMatchmakingInterval !== null,
        estimatedWaitTime: Math.max(0, Math.ceil(publicMatchmakingQueue.length / 2) * 3)
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Word Royale server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.RAILWAY_ENVIRONMENT) {
        console.log(`Railway deployment successful!`);
    }
});

// Cleanup inactive games
setInterval(() => {
    const now = Date.now();
    for (const [gameId, game] of activeGames) {
        // Remove games that have been ended for more than 1 hour
        if (game.status === 'ended' && (now - game.lastActivity) > 3600000) {
            activeGames.delete(gameId);
        }
    }
}, 300000); // Check every 5 minutes