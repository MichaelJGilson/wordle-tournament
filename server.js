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

// Match class for 1v1 tournament matches
class Match {
    constructor(id, gameId, round, player1, player2) {
        this.id = id;
        this.gameId = gameId;
        this.round = round;
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
        let guessPoints = 0;
        for (let i = 0; i < 5; i++) {
            const letter = guess[i];
            if (result[i] === 'correct') {
                // 10 points for correct position (green)
                if (!playerProgress.correctLetters.has(letter)) {
                    guessPoints += 10;
                    playerProgress.correctLetters.add(letter);
                }
            } else if (result[i] === 'present') {
                // 5 points for correct letter, wrong position (yellow)
                if (!playerProgress.correctLetters.has(letter)) {
                    guessPoints += 5;
                    playerProgress.correctLetters.add(letter);
                }
            }
        }

        playerProgress.score += guessPoints;

        if (guess === target) {
            playerProgress.completed = true;
            // Early completion bonus: 50 - (10 * number of guesses used)
            const earlyBonus = Math.max(50 - (playerProgress.currentRow * 10), 10);
            playerProgress.score += earlyBonus;
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

            if (p1Progress.completed && !p2Progress.completed) {
                this.winner = this.player1.id;
            } else if (p2Progress.completed && !p1Progress.completed) {
                this.winner = this.player2.id;
            } else if (p1Progress.completed && p2Progress.completed) {
                // Both completed, winner is who finished faster (fewer rows)
                this.winner = p1Progress.currentRow <= p2Progress.currentRow ? this.player1.id : this.player2.id;
            } else {
                // Neither completed, winner is who made more progress
                if (p1Progress.currentRow > p2Progress.currentRow) {
                    this.winner = this.player1.id;
                } else if (p2Progress.currentRow > p1Progress.currentRow) {
                    this.winner = this.player2.id;
                } else {
                    // Same progress, random winner
                    this.winner = Math.random() < 0.5 ? this.player1.id : this.player2.id;
                }
            }
        }

        // Update database
        db.run(`UPDATE matches SET winner_id = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [this.winner, this.id]);

        // Mark loser as eliminated
        const loserId = this.winner === this.player1.id ? this.player2.id : this.player1.id;
        const game = activeGames.get(this.gameId);
        if (game) {
            const loser = game.players.get(loserId);
            if (loser) {
                loser.alive = false;
                loser.rank = game.players.size - Array.from(game.players.values()).filter(p => p.alive).length + 1;
            }
            // Award points to winner
            const winner = game.players.get(this.winner);
            if (winner) {
                winner.score += 100; // Tournament round win bonus
            }
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

        // Save to database
        db.run(`INSERT INTO players (id, game_id, name, socket_id) VALUES (?, ?, ?, ?)`,
            [playerId, this.id, playerName, socketId]);

        return { success: true, playerId: playerId, player: player };
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

    startGame() {
        if (this.status !== 'waiting' || this.players.size === 0) {
            return false;
        }

        this.status = 'playing';
        this.createTournamentMatches();

        // Update database
        db.run(`UPDATE games SET status = 'playing', started_at = CURRENT_TIMESTAMP WHERE id = ?`, [this.id]);

        return true;
    }

    createTournamentMatches() {
        const alivePlayers = Array.from(this.players.values()).filter(p => p.alive);
        console.log(`Creating tournament matches for ${alivePlayers.length} players in round ${this.round}`);
        
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

        if (alivePlayers.length <= 1) {
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
            
            // Update player's score with match progress
            player.matchScore = matchProgress.score;
            
            // If match is completed, add match score to total
            if (currentMatch.status === 'completed') {
                player.score = (player.score || 0) + matchProgress.score;
                if (currentMatch.winner === playerId) {
                    player.score += 100; // Tournament win bonus
                }
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
                    score: player.matchScore || 0, // Show match score during match
                    totalScore: player.score || 0, // Show tournament total
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
            activeMatches: this.roundMatches.filter(m => m.status === 'active').length
        };

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

        if (game.startGame()) {
            callback({ success: true });
            game.broadcastGameState();
        } else {
            callback({ success: false, error: 'Cannot start game' });
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

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Wordle Battle Royale server running on port ${PORT}`);
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