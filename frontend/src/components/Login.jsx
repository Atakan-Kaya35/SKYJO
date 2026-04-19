import React, { useState } from 'react';
import * as api from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError('');

    try {
      const data = await api.login(username.trim());
      if (data.error) {
        setError(data.error);
      } else {
        onLogin(data.user);
      }
    } catch (err) {
      setError('Could not connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="game-title">🃏 SKYJO</h1>
        <p className="game-subtitle">The exciting card game</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={50}
            autoFocus
            disabled={loading}
          />
          <button type="submit" disabled={loading || !username.trim()}>
            {loading ? 'Connecting...' : 'Play'}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="login-stats">
          <p>No password needed — just pick a username!</p>
        </div>
      </div>
    </div>
  );
}
