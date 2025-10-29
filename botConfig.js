// Bot Difficulty Configuration
// Easy to adjust difficulty by changing these values

const BOT_DIFFICULTIES = {
    EASY: {
        name: 'Easy',
        minThinkTime: 3000,      // Minimum time before making a guess (ms)
        maxThinkTime: 8000,      // Maximum time before making a guess (ms)
        targetGuesses: 6,        // Average number of guesses to solve
        mistakeChance: 0.3,      // 30% chance to make a non-optimal guess
        giveUpChance: 0.1,       // 10% chance to give up after 4 wrong guesses
    },
    MEDIUM: {
        name: 'Medium',
        minThinkTime: 2000,
        maxThinkTime: 5000,
        targetGuesses: 4.5,      // Average 4-5 guesses
        mistakeChance: 0.15,     // 15% chance to make a non-optimal guess
        giveUpChance: 0.05,      // 5% chance to give up
    },
    HARD: {
        name: 'Hard',
        minThinkTime: 1000,
        maxThinkTime: 3000,
        targetGuesses: 3.5,      // Average 3-4 guesses
        mistakeChance: 0.05,     // 5% chance to make a non-optimal guess
        giveUpChance: 0.01,      // 1% chance to give up
    },
    EXPERT: {
        name: 'Expert',
        minThinkTime: 500,
        maxThinkTime: 2000,
        targetGuesses: 3,        // Average 3 guesses
        mistakeChance: 0,        // Never makes mistakes
        giveUpChance: 0,         // Never gives up
    }
};

// Current difficulty setting - CHANGE THIS TO ADJUST BOT DIFFICULTY
const CURRENT_DIFFICULTY = 'MEDIUM';

// Bot name pool for variety
const BOT_NAMES = [
    'WordBot', 'LetterLord', 'GuessGenius', 'VocabViper',
    'AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot',
    'WordWizard', 'LetterLegend', 'GuessGuru', 'VocabVanguard',
    'Lexicon', 'Wordsmith', 'Spellcaster', 'Linguist',
    'Thesaurus', 'Dictionary', 'Scrabbler', 'Riddler'
];

// Bot settings
const BOT_CONFIG = {
    // How many bots to add when starting a game with fewer than 2 players
    MIN_PLAYERS_FOR_START: 2,
    MAX_BOTS_PER_GAME: 10,

    // Whether to add bots automatically
    AUTO_ADD_BOTS: true,

    // Get current difficulty settings
    getDifficulty: () => BOT_DIFFICULTIES[CURRENT_DIFFICULTY],

    // Get a random bot name
    getRandomBotName: (usedNames = []) => {
        const availableNames = BOT_NAMES.filter(name => !usedNames.includes(name));
        if (availableNames.length === 0) {
            return `Bot${Math.floor(Math.random() * 1000)}`;
        }
        return availableNames[Math.floor(Math.random() * availableNames.length)];
    }
};

module.exports = { BOT_CONFIG, BOT_DIFFICULTIES, CURRENT_DIFFICULTY };
