const express = require('express');
const router = express.Router();
const pool = require('../db');
const gameLogic = require('../gameLogic');

// ============================================================
// GET /api/game/state - Get full game state for polling
// Header: x-user-id
// ============================================================
router.get('/state', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    const [playerRows] = await pool.execute(
      `SELECT gp.*, u.username 
       FROM game_players gp 
       JOIN users u ON gp.user_id = u.id 
       ORDER BY gp.turn_order ASC`
    );

    const discardPile = game.discard_pile ? JSON.parse(game.discard_pile) : [];
    const drawPileCount = game.draw_pile ? JSON.parse(game.draw_pile).length : 0;
    const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

    const players = playerRows.map(p => {
      const cards = p.cards ? JSON.parse(p.cards) : null;
      const isCurrentUser = p.user_id.toString() === userId;

      // Calculate live visible score (sum of revealed cards)
      let visibleScore = 0;
      if (cards) {
        for (const row of cards) {
          for (const card of row) {
            if (card && card.revealed) visibleScore += card.value;
          }
        }
      }

      return {
        userId: p.user_id,
        username: p.username,
        turnOrder: p.turn_order,
        isReady: !!p.is_ready,
        roundScore: p.round_score,
        totalGameScore: p.total_game_score,
        visibleScore,
        allRevealed: !!p.all_revealed,
        initialFlipsDone: p.initial_flips_done,
        // Show own cards fully, opponent cards filtered
        cards: cards
          ? isCurrentUser
            ? cards
            : gameLogic.filterCardsForOpponent(cards)
          : null,
      };
    });

    // Check if current user has drawn a card (for action phase)
    const lastDrawnCard =
      game.current_turn_user_id &&
      game.current_turn_user_id.toString() === userId &&
      game.turn_phase === 'action'
        ? game.last_drawn_card
        : null;

    res.json({
      status: game.status,
      hostUserId: game.host_user_id,
      requiredPlayers: game.required_players,
      currentTurnUserId: game.current_turn_user_id,
      turnPhase: game.turn_phase,
      roundNumber: game.round_number,
      roundEnderId: game.round_ender_id,
      finalTurnsRemaining: game.final_turns_remaining,
      drawPileCount,
      topDiscard,
      lastDrawnCard,
      players,
    });
  } catch (err) {
    console.error('Game state error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/initial-flip - Flip a card during initial flip phase
// Header: x-user-id
// Body: { row, col }
// ============================================================
router.post('/initial-flip', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { row, col } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (game.status !== 'initial_flip') {
      return res.status(400).json({ error: 'Not in initial flip phase' });
    }

    const [playerRows] = await pool.execute(
      'SELECT * FROM game_players WHERE user_id = ?',
      [userId]
    );
    if (playerRows.length === 0)
      return res.status(400).json({ error: 'Not in game' });

    const player = playerRows[0];
    if (player.initial_flips_done >= 2) {
      return res.status(400).json({ error: 'Already flipped 2 cards' });
    }

    const cards = JSON.parse(player.cards);

    if (
      row < 0 || row >= 3 || col < 0 || col >= 4 ||
      cards[row][col] === null || cards[row][col].revealed
    ) {
      return res.status(400).json({ error: 'Invalid card position' });
    }

    cards[row][col].revealed = true;

    await pool.execute(
      'UPDATE game_players SET cards = ?, initial_flips_done = ? WHERE user_id = ?',
      [JSON.stringify(cards), player.initial_flips_done + 1, userId]
    );

    // Check if all players have flipped 2 cards
    const [allPlayers] = await pool.execute('SELECT * FROM game_players');
    const allDone = allPlayers.every(p => {
      if (p.user_id.toString() === userId) {
        return player.initial_flips_done + 1 >= 2;
      }
      return p.initial_flips_done >= 2;
    });

    if (allDone) {
      // Transition to playing phase
      // Find player with highest sum of revealed cards to go first
      let highestSum = -Infinity;
      let firstPlayerId = allPlayers[0].user_id;

      for (const p of allPlayers) {
        const pCards = p.user_id.toString() === userId ? cards : JSON.parse(p.cards);
        let sum = 0;
        for (const r of pCards) {
          for (const c of r) {
            if (c && c.revealed) sum += c.value;
          }
        }
        if (sum > highestSum) {
          highestSum = sum;
          firstPlayerId = p.user_id;
        }
      }

      await pool.execute(
        `UPDATE game_state SET status = 'playing', current_turn_user_id = ?, turn_phase = 'draw' WHERE id = 1`,
        [firstPlayerId]
      );
    }

    res.json({ message: 'Card flipped' });
  } catch (err) {
    console.error('Initial flip error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/draw - Draw a card from draw pile or take from discard
// Header: x-user-id
// Body: { source: 'draw' | 'discard' }
// ============================================================
router.post('/draw', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { source } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing phase' });
    }

    if (!game.current_turn_user_id || game.current_turn_user_id.toString() !== userId) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    if (game.turn_phase !== 'draw') {
      return res.status(400).json({ error: 'Not in draw phase' });
    }

    if (source === 'discard') {
      // Take top card from discard pile
      const discardPile = JSON.parse(game.discard_pile);
      if (discardPile.length === 0) {
        return res.status(400).json({ error: 'Discard pile is empty' });
      }

      const card = discardPile.pop();

      // When taking from discard, must replace a card (go to 'replace_discard' phase)
      await pool.execute(
        `UPDATE game_state SET 
          turn_phase = 'replace_discard', 
          last_drawn_card = ?,
          discard_pile = ?
         WHERE id = 1`,
        [card, JSON.stringify(discardPile)]
      );

      res.json({ message: 'Took card from discard pile', card });
    } else {
      // Draw from draw pile
      const drawPile = JSON.parse(game.draw_pile);
      if (drawPile.length === 0) {
        // Reshuffle discard pile into draw pile (keep top card)
        const discardPile = JSON.parse(game.discard_pile);
        const topCard = discardPile.pop();
        const reshuffled = gameLogic.shuffleDeck(discardPile);
        
        await pool.execute(
          `UPDATE game_state SET 
            draw_pile = ?,
            discard_pile = ?
           WHERE id = 1`,
          [JSON.stringify(reshuffled), JSON.stringify([topCard])]
        );
        
        // Now draw from reshuffled pile
        const card = reshuffled.shift();
        await pool.execute(
          `UPDATE game_state SET 
            turn_phase = 'action', 
            last_drawn_card = ?,
            draw_pile = ?
           WHERE id = 1`,
          [card, JSON.stringify(reshuffled)]
        );
        
        res.json({ message: 'Drew card from reshuffled pile', card });
      } else {
        const card = drawPile.shift();

        await pool.execute(
          `UPDATE game_state SET 
            turn_phase = 'action', 
            last_drawn_card = ?,
            draw_pile = ?
           WHERE id = 1`,
          [card, JSON.stringify(drawPile)]
        );

        res.json({ message: 'Drew card from draw pile', card });
      }
    }
  } catch (err) {
    console.error('Draw error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/replace - Replace a card on your grid with the drawn/taken card
// Header: x-user-id
// Body: { row, col }
// Works for both 'action' (drew from pile) and 'replace_discard' (took from discard)
// ============================================================
router.post('/replace', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { row, col } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing phase' });
    }

    if (!game.current_turn_user_id || game.current_turn_user_id.toString() !== userId) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    if (game.turn_phase !== 'action' && game.turn_phase !== 'replace_discard') {
      return res.status(400).json({ error: 'Not in replace phase' });
    }

    const [playerRows] = await pool.execute(
      'SELECT * FROM game_players WHERE user_id = ?',
      [userId]
    );
    const player = playerRows[0];
    const cards = JSON.parse(player.cards);

    if (
      row < 0 || row >= 3 || col < 0 || col >= cards[0].length ||
      cards[row][col] === null
    ) {
      return res.status(400).json({ error: 'Invalid card position' });
    }

    // Replace: discard the old card, place drawn card face-up
    const oldCard = cards[row][col];
    const drawnCard = game.last_drawn_card;

    const discardPile = JSON.parse(game.discard_pile);
    discardPile.push(oldCard.value);

    cards[row][col] = { value: drawnCard, revealed: true };

    // Check for column elimination
    const { cards: updatedCards } = gameLogic.checkColumnElimination(cards);

    // Check if all cards are revealed
    const allRevealed = gameLogic.isAllRevealed(updatedCards);

    await pool.execute(
      'UPDATE game_players SET cards = ?, all_revealed = ? WHERE user_id = ?',
      [JSON.stringify(updatedCards), allRevealed ? 1 : 0, userId]
    );

    // Advance turn
    await advanceTurn(game, userId, allRevealed, discardPile);

    res.json({
      message: 'Card replaced',
      oldCard: { value: oldCard.value, wasRevealed: oldCard.revealed },
      newCard: { value: drawnCard },
      row,
      col,
    });
  } catch (err) {
    console.error('Replace error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/discard-drawn - Discard the drawn card (only when drew from pile)
// Header: x-user-id
// Then must flip a face-down card
// ============================================================
router.post('/discard-drawn', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing phase' });
    }

    if (!game.current_turn_user_id || game.current_turn_user_id.toString() !== userId) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    if (game.turn_phase !== 'action') {
      return res.status(400).json({ error: 'Can only discard when you drew from the pile' });
    }

    // Put drawn card on discard pile
    const discardPile = JSON.parse(game.discard_pile);
    discardPile.push(game.last_drawn_card);

    await pool.execute(
      `UPDATE game_state SET 
        turn_phase = 'flip',
        last_drawn_card = NULL,
        discard_pile = ?
       WHERE id = 1`,
      [JSON.stringify(discardPile)]
    );

    res.json({ message: 'Card discarded, now flip a face-down card' });
  } catch (err) {
    console.error('Discard drawn error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/flip - Flip a face-down card (after discarding drawn card)
// Header: x-user-id
// Body: { row, col }
// ============================================================
router.post('/flip', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { row, col } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (game.status !== 'playing') {
      return res.status(400).json({ error: 'Game is not in playing phase' });
    }

    if (!game.current_turn_user_id || game.current_turn_user_id.toString() !== userId) {
      return res.status(400).json({ error: 'Not your turn' });
    }

    if (game.turn_phase !== 'flip') {
      return res.status(400).json({ error: 'Not in flip phase' });
    }

    const [playerRows] = await pool.execute(
      'SELECT * FROM game_players WHERE user_id = ?',
      [userId]
    );
    const player = playerRows[0];
    const cards = JSON.parse(player.cards);

    if (
      row < 0 || row >= 3 || col < 0 || col >= cards[0].length ||
      cards[row][col] === null || cards[row][col].revealed
    ) {
      return res.status(400).json({ error: 'Must flip a face-down card' });
    }

    const flippedValue = cards[row][col].value;
    cards[row][col].revealed = true;

    // Check for column elimination
    const { cards: updatedCards } = gameLogic.checkColumnElimination(cards);

    // Check if all cards are revealed
    const allRevealed = gameLogic.isAllRevealed(updatedCards);

    await pool.execute(
      'UPDATE game_players SET cards = ?, all_revealed = ? WHERE user_id = ?',
      [JSON.stringify(updatedCards), allRevealed ? 1 : 0, userId]
    );

    const discardPile = JSON.parse(game.discard_pile);
    await advanceTurn(game, userId, allRevealed, discardPile);

    res.json({ message: 'Card flipped', flippedCard: { value: flippedValue }, row, col });
  } catch (err) {
    console.error('Flip error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// POST /api/game/return-to-lobby - After game over, return to lobby
// Header: x-user-id
// ============================================================
router.post('/return-to-lobby', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (!game.host_user_id || game.host_user_id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the host can return to lobby' });
    }

    // Reset game state
    await pool.execute(
      `UPDATE game_state SET 
        status = 'waiting',
        current_turn_user_id = NULL,
        turn_phase = NULL,
        round_number = 0,
        draw_pile = NULL,
        discard_pile = NULL,
        last_drawn_card = NULL,
        round_ender_id = NULL,
        final_turns_remaining = -1
       WHERE id = 1`
    );

    // Reset players
    await pool.execute(
      `UPDATE game_players SET 
        cards = NULL, is_ready = 0, round_score = 0, 
        total_game_score = 0, all_revealed = 0, initial_flips_done = 0`
    );

    res.json({ message: 'Returned to lobby' });
  } catch (err) {
    console.error('Return to lobby error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// Helper: advance turn to next player, handle round-end logic
// ============================================================
async function advanceTurn(game, currentUserId, currentPlayerAllRevealed, discardPile) {
  const [allPlayers] = await pool.execute(
    'SELECT * FROM game_players ORDER BY turn_order ASC'
  );

  // Find current player index
  const currentIdx = allPlayers.findIndex(
    p => p.user_id.toString() === currentUserId.toString()
  );

  // If this player just revealed all their cards, they trigger the end
  if (currentPlayerAllRevealed && game.round_ender_id === null) {
    // This player ends the round - everyone else gets one more turn
    const finalTurns = allPlayers.length - 1;

    const nextIdx = (currentIdx + 1) % allPlayers.length;
    await pool.execute(
      `UPDATE game_state SET 
        turn_phase = 'draw',
        last_drawn_card = NULL,
        current_turn_user_id = ?,
        round_ender_id = ?,
        final_turns_remaining = ?,
        discard_pile = ?
       WHERE id = 1`,
      [
        allPlayers[nextIdx].user_id,
        currentUserId,
        finalTurns,
        JSON.stringify(discardPile),
      ]
    );
    return;
  }

  // If we're in final turns countdown
  if (game.final_turns_remaining > 0 || (game.round_ender_id !== null && game.final_turns_remaining === -1)) {
    const remaining = game.final_turns_remaining > 0 ? game.final_turns_remaining - 1 : allPlayers.length - 2;

    if (remaining <= 0) {
      // Round is over! Calculate scores
      await endRound(game, allPlayers, discardPile);
      return;
    }

    const nextIdx = (currentIdx + 1) % allPlayers.length;
    // Skip the round ender
    let nextPlayer = nextIdx;
    if (allPlayers[nextPlayer].user_id.toString() === (game.round_ender_id || '').toString()) {
      nextPlayer = (nextPlayer + 1) % allPlayers.length;
    }

    await pool.execute(
      `UPDATE game_state SET 
        turn_phase = 'draw',
        last_drawn_card = NULL,
        current_turn_user_id = ?,
        final_turns_remaining = ?,
        discard_pile = ?
       WHERE id = 1`,
      [allPlayers[nextPlayer].user_id, remaining, JSON.stringify(discardPile)]
    );
    return;
  }

  // Normal turn advancement
  const nextIdx = (currentIdx + 1) % allPlayers.length;
  await pool.execute(
    `UPDATE game_state SET 
      turn_phase = 'draw',
      last_drawn_card = NULL,
      current_turn_user_id = ?,
      discard_pile = ?
     WHERE id = 1`,
    [allPlayers[nextIdx].user_id, JSON.stringify(discardPile)]
  );
}

// ============================================================
// Helper: end the round, calculate scores
// ============================================================
async function endRound(game, allPlayers, discardPile) {
  // Reveal all cards for all players
  for (const player of allPlayers) {
    let cards = JSON.parse(player.cards);
    cards = gameLogic.revealAllCards(cards);
    const score = gameLogic.calculateScore(cards);

    await pool.execute(
      'UPDATE game_players SET cards = ?, round_score = ?, all_revealed = 1 WHERE user_id = ?',
      [JSON.stringify(cards), score, player.user_id]
    );
  }

  // Re-fetch players with updated scores
  const [updatedPlayers] = await pool.execute(
    'SELECT * FROM game_players ORDER BY turn_order ASC'
  );

  // Find the round ender's score
  const roundEnder = updatedPlayers.find(
    p => p.user_id.toString() === (game.round_ender_id || '').toString()
  );

  // Find minimum score among non-enders
  let minOtherScore = Infinity;
  for (const p of updatedPlayers) {
    if (p.user_id.toString() !== (game.round_ender_id || '').toString()) {
      if (p.round_score < minOtherScore) minOtherScore = p.round_score;
    }
  }

  // If round ender doesn't have the lowest score, double their score
  let roundEnderDoubled = false;
  if (roundEnder && roundEnder.round_score >= minOtherScore) {
    roundEnderDoubled = true;
    await pool.execute(
      'UPDATE game_players SET round_score = round_score * 2 WHERE user_id = ?',
      [roundEnder.user_id]
    );
  }

  // Update total game scores and save round scores
  const [finalPlayers] = await pool.execute(
    'SELECT * FROM game_players ORDER BY turn_order ASC'
  );

  let anyOver100 = false;

  for (const p of finalPlayers) {
    const newTotal = p.total_game_score + p.round_score;
    if (newTotal >= 100) anyOver100 = true;

    await pool.execute(
      'UPDATE game_players SET total_game_score = ? WHERE user_id = ?',
      [newTotal, p.user_id]
    );

  }

  if (anyOver100) {
    // Game over! Find winner (lowest total)
    const [gamePlayers] = await pool.execute(
      'SELECT * FROM game_players ORDER BY total_game_score ASC'
    );

    // Update user stats
    for (const p of gamePlayers) {
      const isWinner = p.user_id === gamePlayers[0].user_id;
      await pool.execute(
        `UPDATE users SET 
          total_score = total_score + ?, 
          games_played = games_played + 1,
          games_won = games_won + ?
         WHERE id = ?`,
        [p.total_game_score + p.round_score, isWinner ? 1 : 0, p.user_id]
      );
    }

    await pool.execute(
      `UPDATE game_state SET 
        status = 'game_over',
        current_turn_user_id = NULL,
        turn_phase = NULL,
        discard_pile = ?
       WHERE id = 1`,
      [JSON.stringify(discardPile)]
    );
  } else {
    // Round end - go to ready screen for next round
    await pool.execute(
      `UPDATE game_state SET 
        status = 'round_end',
        current_turn_user_id = NULL,
        turn_phase = NULL,
        discard_pile = ?
       WHERE id = 1`,
      [JSON.stringify(discardPile)]
    );

    // Reset ready status for next round
    await pool.execute('UPDATE game_players SET is_ready = 0');
  }
}

module.exports = router;
