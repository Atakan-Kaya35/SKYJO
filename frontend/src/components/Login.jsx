import React, { useState } from 'react';
import * as api from '../api';
import { useLanguage } from '../LanguageContext';
import LanguageToggle from './LanguageToggle';

export default function Login({ onLogin }) {
  const { t } = useLanguage();
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
      setError(t.connectError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <LanguageToggle />
        <h1 className="game-title">🃏 SKYJO</h1>
        <p className="game-subtitle">{t.subtitle}</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder={t.enterUsername}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={50}
            autoFocus
            disabled={loading}
          />
          <button type="submit" disabled={loading || !username.trim()}>
            {loading ? t.connecting : t.play}
          </button>
        </form>

        {error && <p className="error">{error}</p>}

        <div className="login-stats">
          <p>{t.noPassword}</p>
        </div>
      </div>
    </div>
  );
}
