// Bot Difficulty Configuration
// Difficulty scale: 1-10 (1 = easiest, 10 = hardest)
//
// Difficulty affects:
// - Think time (how fast bots guess)
// - Target guesses (how many attempts to solve)
// - Mistake chance (% of non-optimal guesses)
// - Give up chance (% chance to give up)

// Current difficulty setting - CHANGE THIS NUMBER (1-10)
const BOT_DIFFICULTY_LEVEL = 3;  // 3 is easy difficulty

// Calculate difficulty settings based on level (1-10)
function calculateDifficulty(level) {
    // Clamp level between 1 and 10
    const clampedLevel = Math.max(1, Math.min(10, level));

    // Think time: level 1 = 5-10s, level 5 = 2-5s, level 10 = 0.5-1.5s
    const minThinkTime = Math.round(5500 - (clampedLevel * 500));  // 5000ms to 500ms
    const maxThinkTime = Math.round(10500 - (clampedLevel * 900)); // 10000ms to 1500ms

    // Target guesses: level 1 = 6, level 5 = 4.5, level 10 = 3
    const targetGuesses = 6.3 - (clampedLevel * 0.33);

    // Mistake chance: level 1 = 40%, level 5 = 15%, level 10 = 0%
    const mistakeChance = Math.max(0, 0.44 - (clampedLevel * 0.044));

    // Give up chance: level 1 = 15%, level 5 = 5%, level 10 = 0%
    const giveUpChance = Math.max(0, 0.165 - (clampedLevel * 0.0165));

    return {
        level: clampedLevel,
        minThinkTime: Math.max(500, minThinkTime),
        maxThinkTime: Math.max(1500, maxThinkTime),
        targetGuesses: Math.max(3, targetGuesses),
        mistakeChance: Math.max(0, Math.min(1, mistakeChance)),
        giveUpChance: Math.max(0, Math.min(1, giveUpChance)),
    };
}

// Pre-calculated difficulty levels for reference:
// Level 1:  Think: 5.0-9.1s, Guesses: 6.0, Mistakes: 40%, GiveUp: 15%
// Level 3:  Think: 4.0-7.3s, Guesses: 5.3, Mistakes: 31%, GiveUp: 11%
// Level 5:  Think: 3.0-5.5s, Guesses: 4.6, Mistakes: 22%, GiveUp: 7%
// Level 7:  Think: 2.0-3.7s, Guesses: 4.0, Mistakes: 13%, GiveUp: 4%
// Level 10: Think: 0.5-1.5s, Guesses: 3.0, Mistakes: 0%,  GiveUp: 0%

const CURRENT_DIFFICULTY = calculateDifficulty(BOT_DIFFICULTY_LEVEL);

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
    // Target number of players for a full lobby (100 for Battle Royale)
    TARGET_LOBBY_SIZE: 100,
    MAX_BOTS_PER_GAME: 99,

    // Whether to add bots automatically
    AUTO_ADD_BOTS: true,

    // Get current difficulty settings
    getDifficulty: () => CURRENT_DIFFICULTY,

    // Get a random bot name
    getRandomBotName: (usedNames = []) => {
        const availableNames = BOT_NAMES.filter(name => !usedNames.includes(name));
        if (availableNames.length === 0) {
            return `Bot${Math.floor(Math.random() * 1000)}`;
        }
        return availableNames[Math.floor(Math.random() * availableNames.length)];
    }
};

module.exports = { BOT_CONFIG, BOT_DIFFICULTY_LEVEL };
