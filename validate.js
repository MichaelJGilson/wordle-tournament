const fs = require('fs');

try {
    const content = fs.readFileSync('wordle_battle_royale_fixed.html', 'utf8');
    
    // Extract JavaScript from the HTML file
    const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
        const jsContent = scriptMatch[1];
        
        // Try to parse the JavaScript - this will throw if there are syntax errors
        new Function(jsContent);
        console.log('✅ JavaScript syntax is valid');
    } else {
        console.log('❌ No script tag found');
    }
} catch (error) {
    console.log('❌ Syntax error found:', error.message);
    process.exit(1);
}