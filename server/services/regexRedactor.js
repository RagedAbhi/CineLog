/**
 * Redacts a movie plot for the Plot Redacted game.
 * Three-pass redaction:
 * 1. Title scrub: replace title tokens with ████
 * 2. Proper noun detection: skip first word of sentence, redact other capitalized words
 * 3. Name run detection: redact runs of 2+ consecutive title-case words
 * 
 * @param {string} plot The movie plot summary
 * @param {string} title The movie title
 * @returns {string} The redacted plot
 */
function redactPlot(plot, title) {
    if (!plot) return '';
    let redacted = plot;

    // Pass 1: Title Scrub
    const titleTokens = title.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(t => t.length > 2); // Only scrub significant words

    titleTokens.forEach(token => {
        const regex = new RegExp(`\\b${token}\\b`, 'gi');
        redacted = redacted.replace(regex, '████');
    });

    // Pass 2: Proper Noun Detection & Pass 3: Name Run Detection
    // We split into sentences to handle the "skip first word" rule
    const sentences = redacted.split(/([.?!]\s+)/);
    
    const processedSentences = sentences.map((segment, index) => {
        // If it's a delimiter (like ". "), just return it
        if (/^[.?!]\s+$/.test(segment)) return segment;
        
        const words = segment.split(/(\s+)/);
        let firstWordFound = false;

        return words.map(word => {
            // If it's whitespace, return it
            if (/^\s+$/.test(word)) return word;

            // Check if it's the first word of the sentence
            if (!firstWordFound && /[a-zA-Z]/.test(word)) {
                firstWordFound = true;
                return word;
            }

            // Proper noun check: Starts with capital letter (and not already redacted)
            if (/^[A-Z][a-z]*/.test(word) && word !== '████') {
                // Check if it's a known non-proper noun (like "I") - optional but helpful
                if (word === 'I' || word === 'A' || word === 'The') return word;
                return '████';
            }

            return word;
        }).join('');
    });

    redacted = processedSentences.join('');

    // Final cleanup: Handle runs of blocks to merge them if needed, 
    // although the requirement says "redact the whole run as a single block"
    // The current logic redacts word by word. Let's fix Pass 3.
    redacted = redacted.replace(/(████\s+)+████/g, '████');

    return redacted;
}

module.exports = { redactPlot };
