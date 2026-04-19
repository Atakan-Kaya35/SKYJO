const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/lobby/state
// Header: x-user-id
router.get('/state', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    const [playerRows] = await pool.execute(
      `SELECT gp.*, u.username 
       FROM game_players gp 
       JOIN users u ON gp.user_id = u.id 
       ORDER BY gp.turn_order ASC`
    );

    const isHost = game.host_user_id && game.host_user_id.toString() === userId;
    const isInLobby = playerRows.some(p => p.user_id.toString() === userId);

    res.json({
      status: game.status,
      hostUserId: game.host_user_id,
      requiredPlayers: game.required_players,
      roundNumber: game.round_number,
      isHost,
      isInLobby,
      players: playerRows.map(p => ({
        userId: p.user_id,
        username: p.username,
        isReady: !!p.is_ready,
        totalGameScore: p.total_game_score,
      })),
    });
  } catch (err) {
    console.error('Lobby state error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/join
// Header: x-user-id
router.post('/join', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    // Only allow joining during 'waiting' or 'round_end' status
    if (game.status !== 'waiting' && game.status !== 'round_end') {
      return res.status(400).json({ error: 'Game is in progress, cannot join' });
    }

    // Check current player count
    const [playerRows] = await pool.execute('SELECT * FROM game_players');
    
    if (playerRows.length >= 10) {
      return res.status(400).json({ error: 'Game is full (max 10 players)' });
    }

    // Check if already in game
    const alreadyIn = playerRows.some(p => p.user_id.toString() === userId);
    if (alreadyIn) {
      return res.json({ message: 'Already in lobby' });
    }

    const turnOrder = playerRows.length + 1;

    // If no one else is in the lobby, this player becomes host
    if (playerRows.length === 0) {
      await pool.execute(
        'UPDATE game_state SET host_user_id = ?, status = "waiting" WHERE id = 1',
        [userId]
      );
    }

    await pool.execute(
      'INSERT INTO game_players (user_id, turn_order) VALUES (?, ?)',
      [userId, turnOrder]
    );

    res.json({ message: 'Joined lobby' });
  } catch (err) {
    console.error('Join error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/leave
// Header: x-user-id
router.post('/leave', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    // Only allow leaving during waiting
    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Cannot leave during a game' });
    }

    await pool.execute('DELETE FROM game_players WHERE user_id = ?', [userId]);

    // If host left, assign new host
    if (game.host_user_id && game.host_user_id.toString() === userId) {
      const [remaining] = await pool.execute(
        'SELECT user_id FROM game_players ORDER BY turn_order ASC LIMIT 1'
      );
      if (remaining.length > 0) {
        await pool.execute(
          'UPDATE game_state SET host_user_id = ? WHERE id = 1',
          [remaining[0].user_id]
        );
      } else {
        await pool.execute(
          'UPDATE game_state SET host_user_id = NULL WHERE id = 1',
          []
        );
      }
    }

    // Re-number turn orders
    const [players] = await pool.execute(
      'SELECT id FROM game_players ORDER BY turn_order ASC'
    );
    for (let i = 0; i < players.length; i++) {
      await pool.execute('UPDATE game_players SET turn_order = ? WHERE id = ?', [
        i + 1,
        players[i].id,
      ]);
    }

    res.json({ message: 'Left lobby' });
  } catch (err) {
    console.error('Leave error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/ready
// Header: x-user-id
router.post('/ready', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    // Toggle ready status
    await pool.execute(
      'UPDATE game_players SET is_ready = NOT is_ready WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Ready status toggled' });
  } catch (err) {
    console.error('Ready error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/set-players
// Header: x-user-id
// Body: { requiredPlayers }
router.post('/set-players', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { requiredPlayers } = req.body;

    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (!game.host_user_id || game.host_user_id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the host can change player count' });
    }

    const count = Math.max(2, Math.min(10, parseInt(requiredPlayers) || 2));

    await pool.execute(
      'UPDATE game_state SET required_players = ? WHERE id = 1',
      [count]
    );

    res.json({ message: `Required players set to ${count}` });
  } catch (err) {
    console.error('Set players error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/start-game
// Header: x-user-id
// Called automatically when all required players are ready, or manually by host
router.post('/start-game', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (!game.host_user_id || game.host_user_id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the host can start the game' });
    }

    if (game.status !== 'waiting' && game.status !== 'round_end') {
      return res.status(400).json({ error: 'Game cannot be started right now' });
    }

    const [playerRows] = await pool.execute(
      'SELECT * FROM game_players ORDER BY turn_order ASC'
    );

    if (playerRows.length < game.required_players) {
      return res.status(400).json({
        error: `Need ${game.required_players} players, only ${playerRows.length} in lobby`,
      });
    }

    // Check all players are ready
    const allReady = playerRows.every(p => !!p.is_ready);
    if (!allReady) {
      return res.status(400).json({ error: 'Not all players are ready' });
    }

    // Start the game - deal cards
    const gameLogic = require('../gameLogic');
    const deck = gameLogic.shuffleDeck(gameLogic.createDeck());
    const { playerHands, remainingDeck } = gameLogic.dealCards(deck, playerRows.length);

    // Put top card of remaining deck on discard pile
    const firstDiscard = remainingDeck.shift();

    // Update each player's cards
    for (let i = 0; i < playerRows.length; i++) {
      await pool.execute(
        `UPDATE game_players 
         SET cards = ?, is_ready = 0, round_score = 0, all_revealed = 0, initial_flips_done = 0 
         WHERE id = ?`,
        [JSON.stringify(playerHands[i]), playerRows[i].id]
      );
    }

    // Determine if this is a new game or new round
    const newRound = game.status === 'round_end' ? game.round_number + 1 : 1;

    // Reset total_game_score if starting a fresh game (not a new round)
    if (game.status === 'waiting') {
      await pool.execute('UPDATE game_players SET total_game_score = 0');
    }

    // Update game state
    await pool.execute(
      `UPDATE game_state SET 
        status = 'initial_flip',
        current_turn_user_id = ?,
        turn_phase = NULL,
        round_number = ?,
        draw_pile = ?,
        discard_pile = ?,
        last_drawn_card = NULL,
        round_ender_id = NULL,
        final_turns_remaining = -1
       WHERE id = 1`,
      [
        playerRows[0].user_id,
        newRound,
        JSON.stringify(remainingDeck),
        JSON.stringify([firstDiscard]),
      ]
    );

    res.json({ message: 'Game started!' });
  } catch (err) {
    console.error('Start game error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/kick
// Header: x-user-id
// Body: { targetUserId }
router.post('/kick', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { targetUserId } = req.body;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (!game.host_user_id || game.host_user_id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the host can kick players' });
    }

    if (game.status !== 'waiting') {
      return res.status(400).json({ error: 'Can only kick players in lobby' });
    }

    if (targetUserId.toString() === userId) {
      return res.status(400).json({ error: 'Cannot kick yourself' });
    }

    await pool.execute('DELETE FROM game_players WHERE user_id = ?', [targetUserId]);

    // Re-number turn orders
    const [players] = await pool.execute(
      'SELECT id FROM game_players ORDER BY turn_order ASC'
    );
    for (let i = 0; i < players.length; i++) {
      await pool.execute('UPDATE game_players SET turn_order = ? WHERE id = ?', [
        i + 1,
        players[i].id,
      ]);
    }

    res.json({ message: 'Player kicked' });
  } catch (err) {
    console.error('Kick error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/lobby/terminate
// Header: x-user-id
// Host can terminate a game in progress and return everyone to lobby
router.post('/terminate', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    const game = gameRows[0];

    if (!game.host_user_id || game.host_user_id.toString() !== userId) {
      return res.status(403).json({ error: 'Only the host can terminate the game' });
    }

    // Reset game state back to waiting
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

    // Reset players but keep them in lobby
    await pool.execute(
      `UPDATE game_players SET 
        cards = NULL, is_ready = 0, round_score = 0, 
        total_game_score = 0, all_revealed = 0, initial_flips_done = 0`
    );

    res.json({ message: 'Game terminated, returned to lobby' });
  } catch (err) {
    console.error('Terminate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
