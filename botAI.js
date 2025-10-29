// Bot AI for Wordle Battle Royale
// Uses smart word-guessing strategies with configurable difficulty

const { BOT_CONFIG } = require('./botConfig');

class BotPlayer {
    constructor(name, validWords, answerWords) {
        this.name = name;
        this.validWords = validWords;
        this.answerWords = answerWords;
        this.difficulty = BOT_CONFIG.getDifficulty();
        this.guessCount = 0;
        this.thinkTimer = null;
        this.isActive = true;

        // Track what we know about the word
        this.knownLetters = new Array(5).fill(null);  // Known positions
        this.requiredLetters = new Set();              // Letters that must be in word
        this.excludedLetters = new Set();              // Letters not in word
        this.wrongPositions = {};                      // Letters in wrong positions {letter: [positions]}
    }

    // Main method to get the next guess
    async getNextGuess(currentWord, previousGuesses = []) {
        return new Promise((resolve) => {
            // Calculate think time based on difficulty
            const thinkTime = this.difficulty.minThinkTime +
                Math.random() * (this.difficulty.maxThinkTime - this.difficulty.minThinkTime);

            this.thinkTimer = setTimeout(() => {
                this.guessCount++;

                // Check if bot should give up (only on higher guess counts)
                if (this.guessCount > 3 && Math.random() < this.difficulty.giveUpChance) {
                    console.log(`🤖 ${this.name} is giving up after ${this.guessCount} guesses`);
                    resolve(null); // Signal to make a random invalid guess
                    return;
                }

                // Update knowledge from previous guesses
                this.updateKnowledge(previousGuesses, currentWord);

                // Decide if bot should make a mistake
                const shouldMakeMistake = Math.random() < this.difficulty.mistakeChance;

                let guess;
                if (shouldMakeMistake && this.guessCount > 1) {
                    guess = this.makeSuboptimalGuess();
                } else {
                    guess = this.makeOptimalGuess();
                }

                console.log(`🤖 ${this.name} guessing: ${guess} (guess #${this.guessCount})`);
                resolve(guess);
            }, thinkTime);
        });
    }

    // Update what we know from previous guess results
    updateKnowledge(previousGuesses, targetWord) {
        previousGuesses.forEach(guessData => {
            const guess = guessData.guess;
            const result = guessData.result;

            for (let i = 0; i < 5; i++) {
                const letter = guess[i];
                const state = result[i];

                if (state === 'correct') {
                    this.knownLetters[i] = letter;
                    this.requiredLetters.add(letter);
                } else if (state === 'present') {
                    this.requiredLetters.add(letter);
                    if (!this.wrongPositions[letter]) {
                        this.wrongPositions[letter] = [];
                    }
                    this.wrongPositions[letter].push(i);
                } else if (state === 'absent') {
                    this.excludedLetters.add(letter);
                }
            }
        });
    }

    // Make the best possible guess based on current knowledge
    makeOptimalGuess() {
        // First guess - use a good starting word
        if (this.guessCount === 1) {
            const startWords = ['SLATE', 'CRATE', 'TRACE', 'CRANE', 'STARE', 'TALES'];
            return startWords[Math.floor(Math.random() * startWords.length)];
        }

        // Filter words that match our knowledge
        let candidates = this.answerWords.filter(word => this.wordMatchesKnowledge(word));

        if (candidates.length === 0) {
            // Fallback to valid words if no answer words match
            candidates = this.validWords.filter(word => this.wordMatchesKnowledge(word));
        }

        if (candidates.length === 0) {
            // Last resort - random valid word
            return this.validWords[Math.floor(Math.random() * this.validWords.length)];
        }

        // Pick a random word from candidates
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Check if a word matches our current knowledge
    wordMatchesKnowledge(word) {
        // Check known positions
        for (let i = 0; i < 5; i++) {
            if (this.knownLetters[i] && word[i] !== this.knownLetters[i]) {
                return false;
            }
        }

        // Check required letters are present
        for (const letter of this.requiredLetters) {
            if (!word.includes(letter)) {
                return false;
            }
        }

        // Check excluded letters
        for (const letter of this.excludedLetters) {
            if (word.includes(letter)) {
                return false;
            }
        }

        // Check wrong positions
        for (const [letter, positions] of Object.entries(this.wrongPositions)) {
            for (const pos of positions) {
                if (word[pos] === letter) {
                    return false;
                }
            }
        }

        return true;
    }

    // Make a suboptimal guess (for difficulty)
    makeSuboptimalGuess() {
        // Sometimes guess a word that doesn't use all known information
        const randomWords = this.validWords.filter(word => {
            // Must not use excluded letters
            for (const letter of this.excludedLetters) {
                if (word.includes(letter)) {
                    return false;
                }
            }
            return true;
        });

        if (randomWords.length > 0) {
            return randomWords[Math.floor(Math.random() * randomWords.length)];
        }

        return this.makeOptimalGuess();
    }

    // Stop the bot's thinking
    stop() {
        this.isActive = false;
        if (this.thinkTimer) {
            clearTimeout(this.thinkTimer);
            this.thinkTimer = null;
        }
    }

    // Reset bot for a new word
    reset() {
        this.guessCount = 0;
        this.knownLetters = new Array(5).fill(null);
        this.requiredLetters = new Set();
        this.excludedLetters = new Set();
        this.wrongPositions = {};
    }
}

module.exports = { BotPlayer };
