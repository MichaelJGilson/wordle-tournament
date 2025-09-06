// Multiplayer game functions to insert into HTML

// Game creation and joining functions
function createGame() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        showMessage('Please enter your name', 'error');
        return;
    }
    if (!socket || !gameState.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }

    gameState.playerName = playerName;
    socket.emit('createGame', { playerName: playerName }, (response) => {
        if (response.success) {
            gameState.gameId = response.gameId;
            gameState.playerId = response.playerId;
            showLobby();
        } else {
            showMessage(response.error || 'Failed to create game', 'error');
        }
    });
}

function joinGame() {
    const playerName = document.getElementById('playerName').value.trim();
    const gameId = document.getElementById('gameId').value.trim();
    
    if (!playerName) {
        showMessage('Please enter your name', 'error');
        return;
    }
    if (!gameId) {
        showMessage('Please enter a game ID', 'error');
        return;
    }
    if (!socket || !gameState.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }

    gameState.playerName = playerName;
    socket.emit('joinGame', { gameId: gameId, playerName: playerName }, (response) => {
        if (response.success) {
            gameState.gameId = gameId;
            gameState.playerId = response.playerId;
            showLobby();
        } else {
            showMessage(response.error || 'Failed to join game', 'error');
        }
    });
}

function startMultiplayerGame() {
    if (!socket || !gameState.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }

    socket.emit('startGame', {}, (response) => {
        if (!response.success) {
            showMessage(response.error || 'Failed to start game', 'error');
        }
    });
}

function leaveGame() {
    if (socket && gameState.connected) {
        socket.disconnect();
        // Properly reconnect to server
        initializeSocket();
    }
    
    // Reset game state
    gameState = {
        gameId: null,
        playerId: null,
        playerName: '',
        currentWord: '',
        currentGuess: '',
        currentRow: 0,
        gameStatus: 'waiting',
        players: [],
        playersAlive: 0,
        yourRank: 1,
        round: 1,
        score: 0,
        timer: 120,
        eliminationInProgress: false,
        connected: gameState.connected
    };

    showSetup();
}

// UI management functions
function showSetup() {
    document.getElementById('gameSetup').classList.remove('hidden');
    document.getElementById('gameLobby').classList.add('hidden');
    document.getElementById('mainGame').classList.add('hidden');
}

function showLobby() {
    document.getElementById('gameSetup').classList.add('hidden');
    document.getElementById('gameLobby').classList.remove('hidden');
    document.getElementById('mainGame').classList.add('hidden');
    
    document.getElementById('lobbyGameId').textContent = `Game ID: ${gameState.gameId}`;
}

function showGame() {
    document.getElementById('gameSetup').classList.add('hidden');
    document.getElementById('gameLobby').classList.add('hidden');
    document.getElementById('mainGame').classList.remove('hidden');
}

// Game state update from server
function updateGameFromServer(serverGameState) {
    // Update local game state
    gameState.currentWord = serverGameState.currentWord;
    gameState.round = serverGameState.round;
    gameState.timer = serverGameState.timer;
    gameState.playersAlive = serverGameState.playersAlive;
    gameState.players = serverGameState.players;
    gameState.gameStatus = serverGameState.status;
    gameState.eliminationInProgress = serverGameState.eliminationInProgress;

    // Find current player's data
    const currentPlayer = serverGameState.players.find(p => p.id === gameState.playerId);
    if (currentPlayer) {
        gameState.score = currentPlayer.score;
        gameState.yourRank = currentPlayer.rank;
    }

    // Update UI based on game status
    if (serverGameState.status === 'waiting') {
        updateLobby(serverGameState);
    } else if (serverGameState.status === 'playing') {
        showGame();
        updateGameDisplay();
    } else if (serverGameState.status === 'ended') {
        showGame();
        updateGameDisplay();
        showMessage('Game Over!', 'info');
    }
}

function updateLobby(serverGameState) {
    document.getElementById('lobbyPlayerCount').textContent = `Players: ${serverGameState.players.length}/100`;
    
    const lobbyPlayerList = document.getElementById('lobbyPlayerList');
    lobbyPlayerList.innerHTML = '';
    
    serverGameState.players.slice(0, 10).forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.textContent = player.name;
        playerDiv.style.padding = '5px';
        playerDiv.style.background = player.id === gameState.playerId ? '#538d4e' : '#3a3a3c';
        playerDiv.style.margin = '2px';
        playerDiv.style.borderRadius = '5px';
        lobbyPlayerList.appendChild(playerDiv);
    });
}

// Game input handling
function handleKey(key) {
    if (gameState.gameStatus !== 'playing' || gameState.eliminationInProgress) return;

    const currentPlayer = gameState.players.find(p => p.id === gameState.playerId);
    if (!currentPlayer || !currentPlayer.alive) return;

    if (key === 'ENTER') {
        submitGuess();
    } else if (key === 'BACKSPACE') {
        removeLetter();
    } else {
        addLetter(key);
    }
}

function addLetter(letter) {
    if (gameState.currentGuess.length < 5 && gameState.currentRow < 6) {
        gameState.currentGuess += letter;
        updateCurrentRow();
    }
}

function removeLetter() {
    if (gameState.currentGuess.length > 0) {
        gameState.currentGuess = gameState.currentGuess.slice(0, -1);
        updateCurrentRow();
    }
}

function submitGuess() {
    if (gameState.currentGuess.length !== 5) {
        showMessage('Word must be 5 letters long!', 'error');
        shakeRow();
        return;
    }

    if (!socket || !gameState.connected) {
        showMessage('Not connected to server', 'error');
        return;
    }

    socket.emit('makeGuess', { guess: gameState.currentGuess }, (response) => {
        if (response.success) {
            displayGuessResult(response.evaluation);
            gameState.currentRow++;
            gameState.currentGuess = '';
        } else {
            showMessage(response.error || 'Invalid word', 'error');
            shakeRow();
        }
    });
}

function displayGuessResult(evaluation) {
    const { result, correct, player } = evaluation;
    
    // Update the grid with results
    for (let i = 0; i < 5; i++) {
        const cell = document.getElementById(`cell-${gameState.currentRow}-${i}`);
        if (cell) {
            setTimeout(() => {
                cell.classList.add('flipping');
                setTimeout(() => {
                    cell.classList.remove('correct', 'present', 'absent');
                    cell.classList.add(result[i]);
                    cell.classList.remove('flipping');
                }, 300);
            }, i * 100);
        }
    }

    if (correct) {
        showMessage(`Correct! +${player.score - gameState.score} points`, 'success');
    }

    gameState.score = player.score;
}

// Utility functions
function updateCurrentRow() {
    for (let i = 0; i < 5; i++) {
        const cell = document.getElementById(`cell-${gameState.currentRow}-${i}`);
        if (cell) {
            if (i < gameState.currentGuess.length) {
                cell.textContent = gameState.currentGuess[i];
                cell.classList.add('filled');
            } else {
                cell.textContent = '';
                cell.classList.remove('filled');
            }
        }
    }
}

function updateGameDisplay() {
    document.getElementById('playersAlive').textContent = gameState.playersAlive;
    document.getElementById('yourScore').textContent = gameState.score;
    document.getElementById('roundNumber').textContent = gameState.round;
    document.getElementById('yourRank').textContent = gameState.yourRank;

    const minutes = Math.floor(gameState.timer / 60);
    const seconds = gameState.timer % 60;
    document.getElementById('timer').textContent = `Next elimination in: ${minutes}:${seconds.toString().padStart(2, '0')}`;

    updatePlayersList();
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.innerHTML = '';
    const alivePlayers = gameState.players.filter(p => p.alive);
    const topPlayers = alivePlayers.slice(0, 10);

    topPlayers.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `player-item ${player.id === gameState.playerId ? 'you' : ''}`;
        playerDiv.innerHTML = `
            <span class="player-name">#${index + 1} ${player.name}</span>
            <span class="player-score">${player.score}</span>
        `;
        playersList.appendChild(playerDiv);
    });
}

function shakeRow() {
    const currentRowEl = document.querySelector(`#wordGrid .word-row:nth-child(${gameState.currentRow + 1})`);
    if (currentRowEl) {
        currentRowEl.classList.add('shake');
        setTimeout(() => {
            currentRowEl.classList.remove('shake');
        }, 500);
    }
}

function showMessage(text, type) {
    const messageEl = document.getElementById('message');
    if (messageEl) {
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
    }
}

function setupGrid() {
    const grid = document.getElementById('wordGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (let i = 0; i < 6; i++) {
        const row = document.createElement('div');
        row.className = 'word-row';
        
        for (let j = 0; j < 5; j++) {
            const cell = document.createElement('div');
            cell.className = 'letter-cell';
            cell.id = `cell-${i}-${j}`;
            row.appendChild(cell);
        }
        
        grid.appendChild(row);
    }
}

// Initialize on page load
window.addEventListener('load', () => {
    initializeSocket();
    setupGrid();
    showSetup();
});

// Physical keyboard support
document.addEventListener('keydown', function(e) {
    if (gameState.gameStatus !== 'playing') return;

    const key = e.key.toUpperCase();
    if (key === 'ENTER') {
        e.preventDefault();
        handleKey('ENTER');
    } else if (key === 'BACKSPACE') {
        e.preventDefault();
        handleKey('BACKSPACE');
    } else if (key.match(/^[A-Z]$/)) {
        e.preventDefault();
        handleKey(key);
    }
});