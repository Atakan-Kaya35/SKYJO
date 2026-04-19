-- ============================================================
-- SKYJO Card Game - Database Schema
-- Host: freesqldatabase.com (MySQL 5.x compatible)
-- 
-- INSTRUCTIONS:
-- 1. Go to https://www.freesqldatabase.com and create a free database
-- 2. You will receive: host, database name, username, password
-- 3. Log into phpMyAdmin using the link they email you
-- 4. Go to the "SQL" tab and paste this entire file, then click "Go"
-- ============================================================

-- Users table: stores player accounts and lifetime stats
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  total_score INT DEFAULT 0,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Game state: holds the single active game's state
-- Only one row (id=1) will ever exist
CREATE TABLE game_state (
  id INT AUTO_INCREMENT PRIMARY KEY,
  status VARCHAR(20) DEFAULT 'waiting',
  -- status values: 'waiting', 'initial_flip', 'playing', 'round_end', 'game_over'
  host_user_id INT NULL,
  required_players INT DEFAULT 2,
  current_turn_user_id INT NULL,
  turn_phase VARCHAR(20) DEFAULT NULL,
  -- turn_phase values: 'draw', 'action' (drew from pile, must decide), NULL
  round_number INT DEFAULT 0,
  draw_pile TEXT,
  discard_pile TEXT,
  last_drawn_card INT DEFAULT NULL,
  round_ender_id INT DEFAULT NULL,
  final_turns_remaining INT DEFAULT -1,
  -- -1 means round-end not triggered yet
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (current_turn_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert the single game row
INSERT INTO game_state (id, status, required_players) VALUES (1, 'waiting', 2);

-- Game players: players currently in the game/lobby
CREATE TABLE game_players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  cards TEXT,
  -- JSON string: 3x4 array of {value, revealed} objects (null for eliminated)
  is_ready TINYINT DEFAULT 0,
  round_score INT DEFAULT 0,
  total_game_score INT DEFAULT 0,
  turn_order INT DEFAULT 0,
  all_revealed TINYINT DEFAULT 0,
  initial_flips_done INT DEFAULT 0,
  -- tracks how many cards flipped during initial flip phase (need 2)
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NOTE: Only 3 tables allowed on freesqldatabase.com
-- Round scores are tracked in game_players.round_score and game_players.total_game_score
