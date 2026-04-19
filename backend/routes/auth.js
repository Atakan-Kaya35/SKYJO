const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/auth/login
// Body: { username }
// Creates user if not exists, returns user data
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const trimmed = username.trim().substring(0, 50);

    // Try to find existing user
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [trimmed]
    );

    if (rows.length > 0) {
      return res.json({ user: rows[0] });
    }

    // Create new user
    const [result] = await pool.execute(
      'INSERT INTO users (username) VALUES (?)',
      [trimmed]
    );

    const [newUser] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [result.insertId]
    );

    res.json({ user: newUser[0] });
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT username, total_score, games_played, games_won FROM users ORDER BY games_won DESC, total_score ASC LIMIT 50'
    );
    res.json({ leaderboard: rows });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
