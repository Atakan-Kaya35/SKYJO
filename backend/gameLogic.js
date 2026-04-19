// ============================================================
// SKYJO Game Logic
// ============================================================

/**
 * Create a standard SKYJO deck (150 cards):
 *  -2: 5 cards
 *  -1: 10 cards
 *   0: 15 cards
 *   1-12: 10 cards each
 */
function createDeck() {
  const deck = [];
  // -2 × 5
  for (let i = 0; i < 5; i++) deck.push(-2);
  // -1 × 10
  for (let i = 0; i < 10; i++) deck.push(-1);
  // 0 × 15
  for (let i = 0; i < 15; i++) deck.push(0);
  // 1-12 × 10 each
  for (let v = 1; v <= 12; v++) {
    for (let i = 0; i < 10; i++) deck.push(v);
  }
  return deck; // 150 cards total
}

/**
 * Fisher-Yates shuffle
 */
function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

/**
 * Deal 12 cards per player as a 3×4 grid (3 rows, 4 columns).
 * All cards start face-down (revealed: false).
 * Returns { playerHands: [[grid], ...], remainingDeck: [...] }
 */
function dealCards(deck, numPlayers) {
  const d = [...deck];
  const playerHands = [];

  for (let p = 0; p < numPlayers; p++) {
    const grid = [];
    for (let row = 0; row < 3; row++) {
      const rowCards = [];
      for (let col = 0; col < 4; col++) {
        rowCards.push({ value: d.shift(), revealed: false });
      }
      grid.push(rowCards);
    }
    playerHands.push(grid);
  }

  return { playerHands, remainingDeck: d };
}

/**
 * Check and eliminate columns where all 3 cards are revealed and have the same value.
 * Sets eliminated cards to null.
 * Returns { cards, eliminated } where eliminated is the number of columns removed.
 */
function checkColumnElimination(cards) {
  let eliminated = 0;
  const numCols = cards[0] ? cards[0].length : 0;

  for (let col = 0; col < numCols; col++) {
    // Get all non-null cards in this column
    const colCards = [];
    let allRevealed = true;
    let allExist = true;

    for (let row = 0; row < 3; row++) {
      if (cards[row][col] === null) {
        allExist = false;
        break;
      }
      if (!cards[row][col].revealed) {
        allRevealed = false;
        break;
      }
      colCards.push(cards[row][col]);
    }

    if (!allExist || !allRevealed || colCards.length !== 3) continue;

    // Check if all 3 have the same value
    if (colCards[0].value === colCards[1].value && colCards[1].value === colCards[2].value) {
      // Eliminate this column
      for (let row = 0; row < 3; row++) {
        cards[row][col] = null;
      }
      eliminated++;
    }
  }

  return { cards, eliminated };
}

/**
 * Check if all remaining (non-null) cards are revealed.
 */
function isAllRevealed(cards) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cards[row].length; col++) {
      if (cards[row][col] !== null && !cards[row][col].revealed) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Calculate score: sum of values of all remaining (non-null) face-up cards.
 * At round end, all cards should be revealed first.
 */
function calculateScore(cards) {
  let score = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cards[row].length; col++) {
      if (cards[row][col] !== null) {
        score += cards[row][col].value;
      }
    }
  }
  return score;
}

/**
 * Reveal all face-down cards (for round-end scoring).
 */
function revealAllCards(cards) {
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cards[row].length; col++) {
      if (cards[row][col] !== null) {
        cards[row][col].revealed = true;
      }
    }
  }
  return cards;
}

/**
 * Count remaining (non-null, non-revealed) cards.
 */
function countHiddenCards(cards) {
  let count = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < cards[row].length; col++) {
      if (cards[row][col] !== null && !cards[row][col].revealed) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Filter cards for another player's view (hide face-down card values).
 */
function filterCardsForOpponent(cards) {
  return cards.map(row =>
    row.map(card => {
      if (card === null) return null;
      if (card.revealed) return { value: card.value, revealed: true };
      return { value: null, revealed: false };
    })
  );
}

module.exports = {
  createDeck,
  shuffleDeck,
  dealCards,
  checkColumnElimination,
  isAllRevealed,
  calculateScore,
  revealAllCards,
  countHiddenCards,
  filterCardsForOpponent,
};
