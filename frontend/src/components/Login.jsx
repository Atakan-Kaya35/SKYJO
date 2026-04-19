import React, { useState } from 'react';
import * as api from '../api';
import { useLanguage } from '../LanguageContext';
import LanguageToggle from './LanguageToggle';

export default function Login({ onLogin }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLB, setShowLB] = useState(false);
  const [lbData, setLbData] = useState([]);

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

  const openLeaderboard = async () => {
    try {
      const data = await api.getLeaderboard();
      setLbData(data.leaderboard || []);
    } catch (e) { /* ignore */ }
    setShowLB(true);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="top-bar">
          <button className="btn-leaderboard" onClick={openLeaderboard}>{t.leaderboard}</button>
          <LanguageToggle />
        </div>
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

      {showLB && (
        <div className="modal-overlay" onClick={() => setShowLB(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{t.leaderboard}</h2>
            {lbData.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#aaa' }}>{t.lbNoData}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t.player}</th>
                    <th>{t.lbWins}</th>
                    <th>{t.lbPlayed}</th>
                    <th>{t.lbScore}</th>
                  </tr>
                </thead>
                <tbody>
                  {lbData.map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{p.username}</td>
                      <td>{p.games_won}</td>
                      <td>{p.games_played}</td>
                      <td>{p.total_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <button className="btn-secondary" onClick={() => setShowLB(false)}>{t.close}</button>
          </div>
        </div>
      )}
    </div>
  );
}
