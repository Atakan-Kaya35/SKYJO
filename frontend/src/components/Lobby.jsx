import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { useLanguage } from '../LanguageContext';
import LanguageToggle from './LanguageToggle';

export default function Lobby({ user, onGameStart, onLogout }) {
  const { t } = useLanguage();
  const [lobbyState, setLobbyState] = useState(null);
  const [requiredPlayers, setRequiredPlayers] = useState(2);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);

  const fetchLobby = useCallback(async () => {
    try {
      const data = await api.getLobbyState(user.id);
      setLobbyState(data);

      if (data.requiredPlayers) {
        setRequiredPlayers(data.requiredPlayers);
      }

      // If game has started, transition
      if (data.status === 'initial_flip' || data.status === 'playing') {
        onGameStart();
      }
    } catch (err) {
      // Silently ignore poll errors
    }
  }, [user.id, onGameStart]);

  useEffect(() => {
    fetchLobby();
    const interval = setInterval(fetchLobby, 2500);
    return () => clearInterval(interval);
  }, [fetchLobby]);

  const handleJoin = async () => {
    try {
      setError('');
      await api.joinLobby(user.id);
      setJoined(true);
      fetchLobby();
    } catch (err) {
      setError(t.failedJoin);
    }
  };

  const handleLeave = async () => {
    try {
      await api.leaveLobby(user.id);
      setJoined(false);
      fetchLobby();
    } catch (err) {
      setError(t.failedLeave);
    }
  };

  const handleReady = async () => {
    try {
      setError('');
      await api.toggleReady(user.id);
      fetchLobby();
    } catch (err) {
      setError(t.failedReady);
    }
  };

  const handleSetPlayers = async (count) => {
    try {
      setError('');
      setRequiredPlayers(count);
      await api.setRequiredPlayers(user.id, count);
      fetchLobby();
    } catch (err) {
      setError(t.failedSetPlayers);
    }
  };

  const handleStartGame = async () => {
    try {
      setError('');
      const result = await api.startGame(user.id);
      if (result.error) {
        setError(result.error);
      } else {
        onGameStart();
      }
    } catch (err) {
      setError(t.failedStart);
    }
  };

  const handleKick = async (targetUserId) => {
    try {
      setError('');
      await api.kickPlayer(user.id, targetUserId);
      fetchLobby();
    } catch (err) {
      setError(t.failedKick);
    }
  };

  if (!lobbyState) {
    return <div className="lobby-container"><p>{t.loadingLobby}</p></div>;
  }

  const isHost = lobbyState.isHost;
  const isInLobby = lobbyState.isInLobby;
  const myPlayer = lobbyState.players.find(p => p.userId === user.id);
  const allReady = lobbyState.players.length >= lobbyState.requiredPlayers &&
    lobbyState.players.every(p => p.isReady);

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <h2>🃏 {t.lobby}</h2>
          <div className="user-info">
            <LanguageToggle />
            <span>{t.playingAs} <strong>{user.username}</strong></span>
            <button className="btn-small btn-secondary" onClick={onLogout}>{t.logout}</button>
          </div>
        </div>

        {/* Host controls */}
        {isHost && (lobbyState.status === 'waiting' || lobbyState.status === 'round_end') && (
          <div className="host-controls">
            <h3>{t.youAreHost}</h3>
            <div className="player-count-control">
              <label>{t.playersNeeded}</label>
              <div className="count-buttons">
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    className={`btn-count ${requiredPlayers === n ? 'active' : ''}`}
                    onClick={() => handleSetPlayers(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Player list */}
        <div className="player-list">
          <h3>
            {t.players} ({lobbyState.players.length}/{lobbyState.requiredPlayers})
          </h3>
          {lobbyState.players.length === 0 ? (
            <p className="empty-msg">{t.noPlayers}</p>
          ) : (
            <ul>
              {lobbyState.players.map(p => (
                <li key={p.userId} className={p.isReady ? 'ready' : ''}>
                  <span className="player-name">
                    {p.userId === lobbyState.hostUserId && '⭐ '}
                    {p.username}
                    {p.userId === user.id && ` ${t.you}`}
                  </span>
                  <div className="player-actions">
                    <span className={`ready-badge ${p.isReady ? 'is-ready' : 'not-ready'}`}>
                      {p.isReady ? t.ready : t.notReady}
                    </span>
                    {isHost && p.userId !== user.id && lobbyState.status === 'waiting' && (
                      <button
                        className="btn-kick"
                        onClick={() => handleKick(p.userId)}
                        title={t.kickTitle}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="lobby-actions">
          {!isInLobby ? (
            <button className="btn-primary" onClick={handleJoin}>
              {t.joinGame}
            </button>
          ) : (
            <>
              <button
                className={`btn-primary ${myPlayer?.isReady ? 'btn-unready' : ''}`}
                onClick={handleReady}
              >
                {myPlayer?.isReady ? t.unready : t.readyUp}
              </button>

              {isHost && allReady && (
                <button className="btn-start" onClick={handleStartGame}>
                  {t.startGame}
                </button>
              )}

              {lobbyState.status === 'waiting' && (
                <button className="btn-secondary" onClick={handleLeave}>
                  {t.leaveLobby}
                </button>
              )}
            </>
          )}
        </div>

        {error && <p className="error">{error}</p>}

        {/* Stats */}
        <div className="user-stats">
          <p>
            {t.games}: {user.games_played} | {t.wins}: {user.games_won} | {t.totalScore}: {user.total_score}
          </p>
        </div>
      </div>
    </div>
  );
}
