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
    if (publicMatchmakingQueue.length < 2) {
        return; // Need at least 2 players
    }
    
    // Take first 2 players from queue
    const player1Entry = publicMatchmakingQueue.shift();
    const player2Entry = publicMatchmakingQueue.shift();
    
    console.log(`🎮 Creating public match: ${player1Entry.playerName} vs ${player2Entry.playerName}`);
    
    // Get socket instances
    const socket1 = io.sockets.sockets.get(player1Entry.socketId);
    const socket2 = io.sockets.sockets.get(player2Entry.socketId);
    
    // Validate sockets still exist and are not already in games
    if (!socket1 || !socket2) {
        console.log('⚠️ One or both players disconnected, returning to queue processing');
        // Put back the valid player if any
        if (socket1) publicMatchmakingQueue.unshift(player1Entry);
        if (socket2) publicMatchmakingQueue.unshift(player2Entry);
        updateQueuePositions();
        return;
    }
    
    // Check if players are already in games (prevent duplicate matches)
    const existingPlayer1 = playerSockets.get(socket1.id);
    const existingPlayer2 = playerSockets.get(socket2.id);
    
    if (existingPlayer1 || existingPlayer2) {
        console.log('⚠️ One or both players already in games, returning to queue');
        if (!existingPlayer1) publicMatchmakingQueue.unshift(player1Entry);
        if (!existingPlayer2) publicMatchmakingQueue.unshift(player2Entry);
        updateQueuePositions();
        return;
    }
    
    // Create a new public game
    const gameId = generateShortId(6);
    let game;
    
    try {
        game = new Game(gameId, 2); // Max 2 players for public matches
        game.isPublicMatch = true;
        activeGames.set(gameId, game);
        
        // Add both players to the game
        socket1.join(gameId);
        socket2.join(gameId);
        
        const result1 = game.addPlayer(socket1.id, player1Entry.playerName);
        const result2 = game.addPlayer(socket2.id, player2Entry.playerName);
        
        if (!result1.success || !result2.success) {
            throw new Error(`Failed to add players: P1=${result1.success}, P2=${result2.success}`);
        }
        
        // Track players in global map
        playerSockets.set(socket1.id, { gameId, playerId: result1.playerId, name: player1Entry.playerName });
        playerSockets.set(socket2.id, { gameId, playerId: result2.playerId, name: player2Entry.playerName });
        
        // Notify both players they found a match
        socket1.emit('matchFound', {
            gameId: gameId,
            playerId: result1.playerId,
            opponent: player2Entry.playerName
        });
        
        socket2.emit('matchFound', {
            gameId: gameId,
            playerId: result2.playerId,
            opponent: player1Entry.playerName
        });
        
        // Start the game automatically after a brief delay
        setTimeout(() => {
            try {
                if (activeGames.has(gameId) && game.startGame()) {
                    game.broadcastGameState();
                    console.log(`✅ Public match started: ${gameId}`);
                } else {
                    console.log(`⚠️ Failed to start game ${gameId} - cleaning up`);
                    cleanupFailedMatch(gameId, socket1, socket2);
                }
            } catch (error) {
                console.error(`❌ Error starting game ${gameId}:`, error);
                cleanupFailedMatch(gameId, socket1, socket2);
            }
        }, 2000);
        
        console.log(`🎯 Match created successfully: ${gameId}`);
        
    } catch (error) {
        console.error('❌ Failed to create public match:', error);
        
        // Cleanup and return players to queue
        cleanupFailedMatch(gameId, socket1, socket2);
        publicMatchmakingQueue.unshift(player2Entry, player1Entry);
    }
    
    // Update queue positions for remaining players
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

// Calculate round-based score multiplier
function getRoundMultiplier(round) {
    // Round 1: 1x, Round 2: 1.5x, Round 3: 2x, Round 4+: 2.5x, Final: 3x
    if (round === 1) return 1.0;
    if (round === 2) return 1.5;
    if (round === 3) return 2.0;
    if (round >= 7) return 3.0; // Finals (when only 2 players left)
    return 2.5; // Semi-finals and quarters
}

// Match class for 1v1 tournament matches
class Match {
    constructor(id, gameId, round, player1, player2) {
        this.id = id;
        this.gameId = gameId;
        this.round = round;
        this.roundMultiplier = getRoundMultiplier(round);
        this.player1 = player1;
        this.player2 = player2;
        this.word = this.getRandomWord();
        this.status = 'active'; // active, completed
        this.timer = 90; // 1.5 minutes
        this.winner = null;
        this.timerInterval = null;
        
        // Player progress tracking
        this.playerProgress = {
            [player1.id]: { currentRow: 0, guesses: [], completed: false, score: 0, correctLetters: new Set() },
            [player2.id]: { currentRow: 0, guesses: [], completed: false, score: 0, correctLetters: new Set() }
        };
        
        // Save to database
        db.run(`INSERT INTO matches (id, game_id, round_number, player1_id, player2_id, word) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, gameId, round, player1.id, player2.id, this.word]);
        
        this.startTimer();
    }

    getRandomWord() {
        return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timer--;
            if (this.timer <= 0) {
                this.resolveMatch();
            }
        }, 1000);
    }

    evaluateGuess(playerId, guess) {
        const playerProgress = this.playerProgress[playerId];
        if (!playerProgress || playerProgress.currentRow >= 6 || playerProgress.completed) {
            return null;
        }

        const target = this.word;
        const result = [];

        // Wordle evaluation logic
        for (let i = 0; i < 5; i++) {
            if (guess[i] === target[i]) {
                result[i] = 'correct';
            } else {
                result[i] = 'absent';
            }
        }

        const targetLetters = target.split('');
        const guessLetters = guess.split('');

        for (let i = 0; i < 5; i++) {
            if (result[i] === 'correct') {
                targetLetters[i] = null;
                guessLetters[i] = null;
            }
        }

        for (let i = 0; i < 5; i++) {
            if (result[i] === 'absent' && guessLetters[i]) {
                const targetIndex = targetLetters.indexOf(guessLetters[i]);
                if (targetIndex !== -1) {
                    result[i] = 'present';
                    targetLetters[targetIndex] = null;
                }
            }
        }

        // Update player progress
        playerProgress.currentRow++;
        playerProgress.guesses.push({ guess, result, row: playerProgress.currentRow - 1 });

        // Calculate points for this guess
        let basePoints = 0;
        for (let i = 0; i < 5; i++) {
            const letter = guess[i];
            if (result[i] === 'correct') {
                // 10 points for correct position (green)
                if (!playerProgress.correctLetters.has(letter)) {
                    basePoints += 10;
                    playerProgress.correctLetters.add(letter);
                }
            } else if (result[i] === 'present') {
                // 5 points for correct letter, wrong position (yellow)
                if (!playerProgress.correctLetters.has(letter)) {
                    basePoints += 5;
                    playerProgress.correctLetters.add(letter);
                }
            }
        }

        // Apply round multiplier
        const guessPoints = Math.round(basePoints * this.roundMultiplier);
        const previousScore = playerProgress.score;
        playerProgress.score += guessPoints;

        console.log(`📊 Round ${this.round} scoring - Base: ${basePoints}, Multiplier: ${this.roundMultiplier}x, Points: ${guessPoints}, Score: ${previousScore} → ${playerProgress.score}`);

        if (guess === target) {
            playerProgress.completed = true;
            // Generous early completion bonus with better scaling:
            // Guess 1: 150 points, Guess 2: 120 points, Guess 3: 90 points, Guess 4: 60 points, Guess 5: 40 points, Guess 6: 25 points
            const baseBonusByRow = [0, 150, 120, 90, 60, 40, 25]; // Index 0 unused, 1-6 for rows
            const baseBonus = baseBonusByRow[Math.min(playerProgress.currentRow, 6)];
            const earlyBonus = Math.round(baseBonus * this.roundMultiplier);
            playerProgress.score += earlyBonus;
            console.log(`🎉 WORD COMPLETED! Row: ${playerProgress.currentRow}, Base bonus: ${baseBonus}, Multiplied: ${earlyBonus}, Total score: ${playerProgress.score}`);
            this.winner = playerId;
            this.resolveMatch();
        }

        // Save guess to database
        db.run(`INSERT INTO match_progress (match_id, player_id, guess, row_number, result) VALUES (?, ?, ?, ?, ?)`,
            [this.id, playerId, guess, playerProgress.currentRow - 1, JSON.stringify(result)]);

        return {
            result: result,
            correct: guess === target,
            completed: playerProgress.completed,
            pointsEarned: guessPoints,
            totalScore: playerProgress.score,
            earlyBonus: guess === target ? Math.max(50 - (playerProgress.currentRow * 10), 10) : 0
        };
    }

    resolveMatch() {
        if (this.status === 'completed') return;

        this.status = 'completed';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Determine winner if not already set
        if (!this.winner) {
            const p1Progress = this.playerProgress[this.player1.id];
            const p2Progress = this.playerProgress[this.player2.id];

            console.log(`🏆 Determining winner - P1 score: ${p1Progress.score}, P2 score: ${p2Progress.score}`);
            console.log(`🏆 P1 completed: ${p1Progress.completed}, P2 completed: ${p2Progress.completed}`);

            // Primary: Winner is determined by highest score
            if (p1Progress.score > p2Progress.score) {
                this.winner = this.player1.id;
                console.log(`🏆 Player 1 wins by score: ${p1Progress.score} vs ${p2Progress.score}`);
            } else if (p2Progress.score > p1Progress.score) {
                this.winner = this.player2.id;
                console.log(`🏆 Player 2 wins by score: ${p2Progress.score} vs ${p1Progress.score}`);
            } else {
                // Tie-breaker: If scores are equal, check completion status
                if (p1Progress.completed && !p2Progress.completed) {
                    this.winner = this.player1.id;
                    console.log(`🏆 Player 1 wins by completion (tied score)`);
                } else if (p2Progress.completed && !p1Progress.completed) {
                    this.winner = this.player2.id;
                    console.log(`🏆 Player 2 wins by completion (tied score)`);
                } else if (p1Progress.completed && p2Progress.completed) {
                    // Both completed with same score, winner by speed (fewer rows)
                    this.winner = p1Progress.currentRow <= p2Progress.currentRow ? this.player1.id : this.player2.id;
                    console.log(`🏆 Both completed, winner by speed`);
                } else {
                    // Neither completed, same score - winner by progress (more rows attempted)
                    if (p1Progress.currentRow > p2Progress.currentRow) {
                        this.winner = this.player1.id;
                        console.log(`🏆 Player 1 wins by progress`);
                    } else if (p2Progress.currentRow > p1Progress.currentRow) {
                        this.winner = this.player2.id;
                        console.log(`🏆 Player 2 wins by progress`);
                    } else {
                        // Completely tied - random winner
                        this.winner = Math.random() < 0.5 ? this.player1.id : this.player2.id;
                        console.log(`🏆 Completely tied, random winner`);
                    }
                }
            }
        }

        // Update database
        db.run(`UPDATE matches SET winner_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [this.winner, this.id]);

        // Handle elimination differently for public vs tournament matches
        const loserId = this.winner === this.player1.id ? this.player2.id : this.player1.id;
        const game = activeGames.get(this.gameId);
        if (game) {
            const loser = game.players.get(loserId);
            const winner = game.players.get(this.winner);
            
            // Only eliminate loser in traditional tournament mode, not in public matches
            if (loser && !game.isPublicMatch) {
                loser.alive = false;
                loser.rank = game.players.size - Array.from(game.players.values()).filter(p => p.alive).length + 1;
            }
            
            // Award points to winner
            if (winner) {
                winner.score += 100; // Tournament round win bonus
            }
            
            console.log(`🎯 Match completed: ${this.winner === this.player1.id ? this.player1.name : this.player2.name} wins! Public match: ${game.isPublicMatch ? 'Yes' : 'No'}`);
        }
    }

    getOpponentProgress(playerId) {
        const opponentId = playerId === this.player1.id ? this.player2.id : this.player1.id;
        const opponentProgress = this.playerProgress[opponentId];
        
        // Return only color information, not actual letters
        return opponentProgress.guesses.map(guess => ({
            row: guess.row,
            result: guess.result // Only colors, no letters
        }));
    }
}

class Game {
    constructor(id, maxPlayers = 100) {
        this.id = id;
        this.status = 'waiting'; // waiting, playing, ended
        this.players = new Map();
        this.currentWord = '';
        this.round = 1;
        this.timer = 90; // 1.5 minutes for tournament matches
        this.maxPlayers = maxPlayers;
        this.timerInterval = null;
        this.eliminationInProgress = false;
        this.hostId = null; // Track the game host (first player to join)
        
        // Tournament-specific properties
        this.tournamentMode = true;
        this.matches = new Map(); // matchId -> Match object
        this.roundMatches = []; // current round's matches
        this.bracketHistory = []; // history of all tournament rounds
        
        // Save to database
        db.run(`INSERT INTO games (id, max_players) VALUES (?, ?)`, [id, maxPlayers]);
    }

    addPlayer(socketId, playerName) {
        if (this.players.size >= this.maxPlayers) {
            return { success: false, error: 'Game is full' };
        }

        const playerId = uuidv4();
        const player = {
            id: playerId,
            name: playerName,
            socketId: socketId,
            score: 0,
            currentGuess: '',
            currentRow: 0,
            alive: true,
            rank: null,
            completedCurrentWord: false
        };

        this.players.set(playerId, player);
        playerSockets.set(socketId, { gameId: this.id, playerId: playerId });

        // Set host as the first player to join (only for custom games)
        if (!this.isPublicMatch && !this.hostId) {
            this.hostId = playerId;
            console.log(`🏠 Host set to ${playerName} (${playerId}) for game ${this.id}`);
        }

        // Save to database
        db.run(`INSERT INTO players (id, game_id, name, socket_id) VALUES (?, ?, ?, ?)`,
            [playerId, this.id, playerName, socketId]);

        return { success: true, playerId: playerId, player: player, isHost: playerId === this.hostId };
    }

    removePlayer(socketId) {
        const playerInfo = playerSockets.get(socketId);
        if (playerInfo) {
            this.players.delete(playerInfo.playerId);
            playerSockets.delete(socketId);
            
            // Update database
            db.run(`UPDATE players SET alive = 0 WHERE socket_id = ?`, [socketId]);
        }
    }

    startGame(requestingPlayerId = null) {
        if (this.status !== 'waiting') {
            return { success: false, error: 'Game already started or ended' };
        }

        // Check minimum players requirement
        if (this.players.size < 2) {
            return { success: false, error: 'At least 2 players required to start the game' };
        }

        // For custom games, only host can start
        if (!this.isPublicMatch && requestingPlayerId !== this.hostId) {
            return { success: false, error: 'Only the host can start the game' };
        }

        this.status = 'playing';
        this.createTournamentMatches();

        // Update database
        db.run(`UPDATE games SET status = 'playing', started_at = CURRENT_TIMESTAMP WHERE id = ?`, [this.id]);

        return { success: true };
    }

    createTournamentMatches() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        console.log(`Creating tournament matches for ${alivePlayers.length} players in round ${this.round}`);
        
        // Reset all alive players for new tournament round
        alivePlayers.forEach(player => {
            player.currentRow = 0;
            player.currentGuess = '';
            player.completedCurrentWord = false;
            player.matchScore = 0;
            console.log(`🔄 Reset player ${player.name}: currentRow=${player.currentRow}`);
        });
        
        // Shuffle players for random matchmaking
        for (let i = alivePlayers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [alivePlayers[i], alivePlayers[j]] = [alivePlayers[j], alivePlayers[i]];
        }

        this.roundMatches = [];
        
        // Create matches in pairs
        for (let i = 0; i < alivePlayers.length - 1; i += 2) {
            const matchId = uuidv4();
            const match = new Match(matchId, this.id, this.round, alivePlayers[i], alivePlayers[i + 1]);
            
            this.matches.set(matchId, match);
            this.roundMatches.push(match);
        }

        // Handle odd number of players (bye round)
        if (alivePlayers.length % 2 === 1) {
            const byePlayer = alivePlayers[alivePlayers.length - 1];
            byePlayer.score += 50; // Bye round bonus
            console.log(`Player ${byePlayer.name} gets a bye round`);
        }

        console.log(`Created ${this.roundMatches.length} matches for round ${this.round}`);
        this.monitorMatches();
    }

    monitorMatches() {
        const checkMatches = () => {
            const activeMatches = this.roundMatches.filter(match => match.status === 'active');
            
            if (activeMatches.length === 0) {
                // All matches completed, advance to next round
                this.advanceToNextRound();
            } else {
                // Continue monitoring
                setTimeout(checkMatches, 1000);
            }
        };
        
        setTimeout(checkMatches, 1000);
    }

    advanceToNextRound() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        console.log(`Round ${this.round} completed. ${alivePlayers.length} players remaining`);

        // For public matches (2 players), implement best-of-5 system
        if (this.isPublicMatch && this.players.size === 2) {
            const maxRounds = 5;
            const player1 = Array.from(this.players.values())[0];
            const player2 = Array.from(this.players.values())[1];
            
            // Count wins for each player
            let player1Wins = 0;
            let player2Wins = 0;
            
            this.bracketHistory.forEach(roundData => {
                if (roundData.matches && roundData.matches.length > 0) {
                    const match = roundData.matches[0]; // Should only be one match per round in 2-player game
                    if (match.winner === player1.id) player1Wins++;
                    if (match.winner === player2.id) player2Wins++;
                }
            });
            
            // Add current round's winner
            const currentMatch = this.roundMatches[0];
            if (currentMatch && currentMatch.winner === player1.id) player1Wins++;
            if (currentMatch && currentMatch.winner === player2.id) player2Wins++;
            
            console.log(`📊 Public match score: ${player1.name} ${player1Wins} - ${player2Wins} ${player2.name}`);
            
            // Check if someone won (first to 3 wins, or after 5 rounds)
            const winsNeeded = Math.ceil(maxRounds / 2); // 3 wins needed out of 5
            if (player1Wins >= winsNeeded || player2Wins >= winsNeeded || this.round >= maxRounds) {
                console.log(`🏆 Public match concluded after ${this.round} rounds`);
                this.endGame();
                return;
            }
            
            // Reset both players to alive for next round (no elimination in public matches)
            player1.alive = true;
            player2.alive = true;
            
            console.log(`🔄 Public match continuing to round ${this.round + 1}`);
        } else if (alivePlayers.length <= 1) {
            // Traditional tournament elimination logic
            this.endGame();
            return;
        }

        // Save current round to history
        this.bracketHistory.push({
            round: this.round,
            matches: [...this.roundMatches]
        });

        this.round++;
        console.log(`Starting round ${this.round}`);
        
        // Brief pause between rounds
        setTimeout(() => {
            this.createTournamentMatches();
            this.broadcastGameState();
        }, 3000);
    }

    getRandomWord() {
        return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
    }

    validateGuess(guess) {
        return VALID_WORDS.includes(guess.toUpperCase());
    }

    evaluateGuess(playerId, guess) {
        const player = this.players.get(playerId);
        if (!player || !player.alive) {
            return null;
        }

        // Find the player's current match
        const currentMatch = this.roundMatches.find(match => 
            match.status === 'active' && 
            (match.player1.id === playerId || match.player2.id === playerId)
        );

        if (!currentMatch) {
            return null;
        }

        const result = currentMatch.evaluateGuess(playerId, guess);
        if (result) {
            // Update player's current row for UI consistency
            const matchProgress = currentMatch.playerProgress[playerId];
            player.currentRow = matchProgress.currentRow;
            player.completedCurrentWord = matchProgress.completed;
            
            // Update player's score with match progress (live update)
            player.matchScore = matchProgress.score;
            
            // If match is completed, add match score to total
            if (currentMatch.status === 'completed') {
                player.score = (player.score || 0) + matchProgress.score;
                if (currentMatch.winner === playerId) {
                    player.score += 100; // Tournament win bonus
                }
            } else {
                // During active match, show live match score
                player.currentMatchScore = matchProgress.score;
            }
            
            // Return the result with the updated player information
            return {
                result: result.result,
                correct: result.correct,
                completed: result.completed,
                pointsEarned: result.pointsEarned,
                totalScore: result.totalScore,
                earlyBonus: result.earlyBonus,
                player: {
                    currentRow: player.currentRow,
                    currentMatchScore: player.currentMatchScore || 0, // Live match score
                    totalTournamentScore: player.score || 0, // Tournament total
                    completedCurrentWord: player.completedCurrentWord
                }
            };
        }

        return result;
    }

    getPlayerMatch(playerId) {
        return this.roundMatches.find(match => 
            match.status === 'active' && 
            (match.player1.id === playerId || match.player2.id === playerId)
        );
    }

    // Tournament matches handle their own timers, no global timer needed

    endGame() {
        this.status = 'ended';
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Update database
        db.run(`UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?`, [this.id]);
        
        this.broadcastGameState();
    }

    broadcastGameState() {
        // Send personalized game state to each player
        Array.from(this.players.values()).forEach(player => {
            const personalizedState = this.getGameState(player.id);
            const socketInfo = playerSockets.get(player.socketId);
            if (socketInfo) {
                io.to(player.socketId).emit('gameUpdate', personalizedState);
            }
        });
    }

    getGameState(requestingPlayerId = null) {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        const allPlayers = Array.from(this.players.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((player, index) => ({
                id: player.id,
                name: player.name,
                score: player.score || 0,
                currentMatchScore: player.currentMatchScore || 0,
                alive: player.alive,
                rank: player.alive ? index + 1 : player.rank,
                currentRow: player.currentRow || 0,
                completedCurrentWord: player.completedCurrentWord || false
            }));

        const gameState = {
            gameId: this.id,
            status: this.status,
            round: this.round,
            playersAlive: alivePlayers.length,
            players: allPlayers,
            tournamentMode: this.tournamentMode,
            totalMatches: this.roundMatches.length,
            activeMatches: this.roundMatches.filter(m => m.status === 'active').length,
            isPublicMatch: this.isPublicMatch || false
        };

        // Add series score for public matches
        if (this.isPublicMatch && this.players.size === 2) {
            const player1 = Array.from(this.players.values())[0];
            const player2 = Array.from(this.players.values())[1];
            
            // Count wins for each player from match history
            let player1Wins = 0;
            let player2Wins = 0;
            
            this.bracketHistory.forEach(roundData => {
                if (roundData.matches && roundData.matches.length > 0) {
                    const match = roundData.matches[0];
                    if (match.winner === player1.id) player1Wins++;
                    if (match.winner === player2.id) player2Wins++;
                }
            });
            
            gameState.seriesScore = {
                player1: { id: player1.id, name: player1.name, wins: player1Wins },
                player2: { id: player2.id, name: player2.name, wins: player2Wins },
                maxRounds: 5,
                winsNeeded: 3
            };
        }

        // Add host information for custom games
        if (!this.isPublicMatch && this.hostId) {
            const hostPlayer = this.players.get(this.hostId);
            if (hostPlayer) {
                gameState.host = {
                    id: this.hostId,
                    name: hostPlayer.name
                };
                
                // Add flag to indicate if requesting player is the host
                if (requestingPlayerId) {
                    gameState.isHost = requestingPlayerId === this.hostId;
                }
            }
        }

        // Add match-specific information for requesting player
        if (requestingPlayerId && this.status === 'playing') {
            const playerMatch = this.getPlayerMatch(requestingPlayerId);
            if (playerMatch) {
                gameState.currentMatch = {
                    id: playerMatch.id,
                    opponent: playerMatch.player1.id === requestingPlayerId ? 
                        { id: playerMatch.player2.id, name: playerMatch.player2.name } :
                        { id: playerMatch.player1.id, name: playerMatch.player1.name },
                    timer: playerMatch.timer,
                    status: playerMatch.status,
                    opponentProgress: playerMatch.getOpponentProgress(requestingPlayerId)
                };
            }
        }

        return gameState;
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
            const game = new Game(gameId, maxPlayers);
            
            activeGames.set(gameId, game);
            socket.join(gameId);
            
            const result = game.addPlayer(socket.id, playerName);
            console.log(`🎯 AddPlayer result:`, result);
            
            if (result.success) {
                console.log(`✅ Game created successfully! GameID: ${gameId}, PlayerID: ${result.playerId}`);
                callback({ success: true, gameId: gameId, playerId: result.playerId });
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

        if (!game.validateGuess(guess)) {
            callback({ success: false, error: 'Invalid word' });
            return;
        }

        const result = game.evaluateGuess(playerInfo.playerId, guess.toUpperCase());
        if (result) {
            callback({ success: true, evaluation: result });
            
            // Broadcast updated state to both players in the match
            const playerMatch = game.getPlayerMatch(playerInfo.playerId);
            if (playerMatch) {
                // Send updated state to both players in this match
                [playerMatch.player1, playerMatch.player2].forEach(matchPlayer => {
                    const personalizedState = game.getGameState(matchPlayer.id);
                    io.to(matchPlayer.socketId).emit('gameUpdate', personalizedState);
                });
            }
        } else {
            callback({ success: false, error: 'Could not process guess' });
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