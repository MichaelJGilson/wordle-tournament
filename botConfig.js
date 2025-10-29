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

    // Think time: MUCH SLOWER - level 1 = 15-30s, level 3 = 10-20s, level 5 = 6-12s, level 10 = 2-4s
    const minThinkTime = Math.round(17000 - (clampedLevel * 1500));  // 15500ms to 2000ms
    const maxThinkTime = Math.round(32000 - (clampedLevel * 2800)); // 29200ms to 4000ms

    // Target guesses: level 1 = 6, level 3 = 5.3, level 5 = 4.5, level 10 = 3
    const targetGuesses = 6.3 - (clampedLevel * 0.33);

    // Mistake chance: MUCH HIGHER - level 1 = 60%, level 3 = 50%, level 5 = 40%, level 10 = 10%
    const mistakeChance = Math.max(0.1, 0.66 - (clampedLevel * 0.056));

    // Give up chance: level 1 = 30%, level 3 = 22%, level 5 = 15%, level 10 = 1%
    const giveUpChance = Math.max(0.01, 0.329 - (clampedLevel * 0.032));

    return {
        level: clampedLevel,
        minThinkTime: Math.max(2000, minThinkTime),
        maxThinkTime: Math.max(4000, maxThinkTime),
        targetGuesses: Math.max(3, targetGuesses),
        mistakeChance: Math.max(0, Math.min(1, mistakeChance)),
        giveUpChance: Math.max(0, Math.min(1, giveUpChance)),
    };
}

// Pre-calculated difficulty levels for reference:
// Level 1:  Think: 15-29s, Guesses: 6.0, Mistakes: 60%, GiveUp: 30%
// Level 3:  Think: 10-20s, Guesses: 5.3, Mistakes: 50%, GiveUp: 22%
// Level 5:  Think: 6-12s,  Guesses: 4.6, Mistakes: 40%, GiveUp: 15%
// Level 7:  Think: 4-8s,   Guesses: 4.0, Mistakes: 27%, GiveUp: 8%
// Level 10: Think: 2-4s,   Guesses: 3.0, Mistakes: 10%, GiveUp: 1%

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
