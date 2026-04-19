require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./db');

const PORT = process.env.PORT || 3000;

// CORS configuration - allow GitHub Pages origin
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://atakan-kaya35.github.io',
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (curl, mobile apps, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.some(o => origin.startsWith(o))) {
        return callback(null, true);
      }
      callback(null, false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-user-id'],
  })
);

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'SKYJO Backend is running!' });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/lobby', require('./routes/lobby'));
app.use('/api/game', require('./routes/game'));

// Auto-cleanup: disband/terminate inactive games
setInterval(async () => {
  try {
    const [gameRows] = await pool.execute('SELECT * FROM game_state WHERE id = 1');
    if (!gameRows.length) return;
    const game = gameRows[0];

    const now = new Date();
    const updatedAt = new Date(game.updated_at);
    const diffHours = (now - updatedAt) / (1000 * 60 * 60);

    // Disband lobby if waiting for 2+ hours with no activity
    if (game.status === 'waiting' && game.host_user_id && diffHours >= 2) {
      console.log('Auto-cleanup: Disbanding inactive lobby (2+ hours idle)');
      await pool.execute('DELETE FROM game_players');
      await pool.execute(
        `UPDATE game_state SET 
          host_user_id = NULL, status = 'waiting', current_turn_user_id = NULL,
          turn_phase = NULL, round_number = 0, draw_pile = NULL,
          discard_pile = NULL, last_drawn_card = NULL,
          round_ender_id = NULL, final_turns_remaining = -1
         WHERE id = 1`
      );
    }

    // Terminate game if no actions for 1+ hour during play
    if (['playing', 'initial_flip', 'round_end'].includes(game.status) && diffHours >= 1) {
      console.log('Auto-cleanup: Terminating inactive game (1+ hour idle)');
      await pool.execute(
        `UPDATE game_state SET 
          status = 'waiting', current_turn_user_id = NULL,
          turn_phase = NULL, round_number = 0, draw_pile = NULL,
          discard_pile = NULL, last_drawn_card = NULL,
          round_ender_id = NULL, final_turns_remaining = -1
         WHERE id = 1`
      );
      await pool.execute(
        `UPDATE game_players SET 
          cards = NULL, is_ready = 0, round_score = 0,
          total_game_score = 0, all_revealed = 0, initial_flips_done = 0`
      );
    }
  } catch (err) {
    console.error('Auto-cleanup error:', err);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

app.listen(PORT, () => {
  console.log(`SKYJO backend running on port ${PORT}`);
});
