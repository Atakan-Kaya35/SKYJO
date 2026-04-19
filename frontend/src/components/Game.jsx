import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import Card from './Card';
import PlayerGrid from './PlayerGrid';

export default function Game({ user, onReturnToLobby }) {
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const data = await api.getGameState(user.id);
      setGameState(data);

      // If game ended or returned to lobby
      if (data.status === 'waiting') {
        onReturnToLobby();
      }
    } catch (err) {
      // Silently ignore poll errors
    }
  }, [user.id, onReturnToLobby]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2500);
    return () => clearInterval(interval);
  }, [fetchState]);

  if (!gameState) {
    return <div className="game-container"><p>Loading game...</p></div>;
  }

  const myPlayer = gameState.players.find(p => p.userId === user.id);
  const isMyTurn = gameState.currentTurnUserId === user.id;
  const currentTurnPlayer = gameState.players.find(
    p => p.userId === gameState.currentTurnUserId
  );

  // ---- Action handlers ----
  const doAction = async (actionFn) => {
    setActionLoading(true);
    setError('');
    try {
      const result = await actionFn();
      if (result.error) setError(result.error);
      await fetchState();
    } catch (err) {
      setError('Action failed. Try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitialFlip = (row, col) => {
    doAction(() => api.initialFlip(user.id, row, col));
  };

  const handleDraw = (source) => {
    doAction(() => api.drawCard(user.id, source));
  };

  const handleReplace = (row, col) => {
    doAction(() => api.replaceCard(user.id, row, col));
  };

  const handleDiscardDrawn = () => {
    doAction(() => api.discardDrawn(user.id));
  };

  const handleFlip = (row, col) => {
    doAction(() => api.flipCard(user.id, row, col));
  };

  const handleReady = () => {
    doAction(() => api.toggleReady(user.id));
  };

  const handleStartNextRound = () => {
    doAction(() => api.startGame(user.id));
  };

  const handleReturnToLobby = () => {
    doAction(() => api.returnToLobby(user.id));
  };

  // ---- Determine what cards are clickable ----
  const getClickableCards = () => {
    if (!isMyTurn && gameState.status !== 'initial_flip') return null;

    if (gameState.status === 'initial_flip') {
      if (myPlayer.initialFlipsDone >= 2) return null;
      return (row, col, card) => card !== null && !card.revealed;
    }

    if (gameState.turnPhase === 'action' || gameState.turnPhase === 'replace_discard') {
      // Can replace any card (face up or face down)
      return (row, col, card) => card !== null;
    }

    if (gameState.turnPhase === 'flip') {
      // Must flip a face-down card
      return (row, col, card) => card !== null && !card.revealed;
    }

    return null;
  };

  const handleCardClick = (row, col) => {
    if (actionLoading) return;

    if (gameState.status === 'initial_flip') {
      handleInitialFlip(row, col);
      return;
    }

    if (gameState.turnPhase === 'action' || gameState.turnPhase === 'replace_discard') {
      handleReplace(row, col);
      return;
    }

    if (gameState.turnPhase === 'flip') {
      handleFlip(row, col);
      return;
    }
  };

  // ---- Render: Initial Flip Phase ----
  if (gameState.status === 'initial_flip') {
    return (
      <div className="game-container">
        <div className="game-header">
          <h2>🃏 Initial Card Flip</h2>
          <p className="instruction">
            {myPlayer.initialFlipsDone >= 2
              ? 'Waiting for other players to flip their cards...'
              : `Flip ${2 - myPlayer.initialFlipsDone} more card(s) to reveal!`}
          </p>
        </div>

        <div className="game-board">
          <div className="my-area">
            <PlayerGrid
              player={myPlayer}
              isCurrentUser={true}
              onCardClick={handleCardClick}
              clickableCards={getClickableCards()}
            />
          </div>

          <div className="opponents-area">
            {gameState.players
              .filter(p => p.userId !== user.id)
              .map(p => (
                <PlayerGrid key={p.userId} player={p} isCurrentUser={false} small />
              ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  // ---- Render: Round End ----
  if (gameState.status === 'round_end') {
    const isHost = gameState.hostUserId === user.id;
    const sortedPlayers = [...gameState.players].sort(
      (a, b) => a.totalGameScore - b.totalGameScore
    );
    const allReady = gameState.players.every(p => p.isReady);

    return (
      <div className="game-container">
        <div className="round-end">
          <h2>📊 Round {gameState.roundNumber} Complete!</h2>

          {gameState.roundEnderId && (
            <p className="round-ender-info">
              {gameState.players.find(p => p.userId === gameState.roundEnderId)?.username} ended the round
            </p>
          )}

          <div className="scoreboard">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>Round Score</th>
                  <th>Total Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.userId} className={p.userId === user.id ? 'my-row' : ''}>
                    <td>{idx + 1}</td>
                    <td>
                      {p.username}
                      {p.userId === gameState.roundEnderId && ' 🏁'}
                    </td>
                    <td>{p.roundScore}</td>
                    <td>{p.totalGameScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="round-end-grids">
            {gameState.players.map(p => (
              <PlayerGrid key={p.userId} player={p} isCurrentUser={p.userId === user.id} small />
            ))}
          </div>

          <div className="lobby-actions">
            <button
              className={`btn-primary ${myPlayer?.isReady ? 'btn-unready' : ''}`}
              onClick={handleReady}
            >
              {myPlayer?.isReady ? 'Unready' : '✋ Ready for Next Round'}
            </button>

            {isHost && allReady && (
              <button className="btn-start" onClick={handleStartNextRound}>
                🚀 Start Next Round!
              </button>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- Render: Game Over ----
  if (gameState.status === 'game_over') {
    const isHost = gameState.hostUserId === user.id;
    const sortedPlayers = [...gameState.players].sort(
      (a, b) => a.totalGameScore - b.totalGameScore
    );
    const winner = sortedPlayers[0];

    return (
      <div className="game-container">
        <div className="game-over">
          <h2>🏆 Game Over!</h2>
          <p className="winner-text">
            {winner.username} wins with {winner.totalGameScore} points!
          </p>

          <div className="scoreboard">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Final Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.userId} className={p.userId === user.id ? 'my-row' : ''}>
                    <td>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
                    <td>{p.username}{p.userId === user.id ? ' (you)' : ''}</td>
                    <td>{p.totalGameScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isHost && (
            <div className="lobby-actions">
              <button className="btn-primary" onClick={handleReturnToLobby}>
                🔙 Return to Lobby
              </button>
            </div>
          )}

          {!isHost && (
            <p className="waiting-msg">Waiting for host to return to lobby...</p>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- Render: Playing Phase ----
  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🃏 SKYJO — Round {gameState.roundNumber}</h2>
        <div className="turn-info">
          {isMyTurn ? (
            <span className="your-turn">🎯 Your Turn!</span>
          ) : (
            <span className="waiting-turn">
              Waiting for <strong>{currentTurnPlayer?.username}</strong>...
            </span>
          )}
          {gameState.finalTurnsRemaining > 0 && (
            <span className="final-turns">⚠️ Final turns! ({gameState.finalTurnsRemaining} left)</span>
          )}
        </div>
      </div>

      <div className="game-board">
        {/* Draw & Discard piles */}
        <div className="piles-area">
          <div className="pile">
            <p className="pile-label">Draw Pile ({gameState.drawPileCount})</p>
            <div
              className={`card card-hidden ${isMyTurn && gameState.turnPhase === 'draw' ? 'card-clickable' : ''}`}
              onClick={() => isMyTurn && gameState.turnPhase === 'draw' && handleDraw('draw')}
            >
              <span className="card-back">🂠</span>
            </div>
          </div>

          <div className="pile">
            <p className="pile-label">Discard Pile</p>
            {gameState.topDiscard !== null && gameState.topDiscard !== undefined ? (
              <Card
                card={{ value: gameState.topDiscard, revealed: true }}
                onClick={() => isMyTurn && gameState.turnPhase === 'draw' && handleDraw('discard')}
                clickable={isMyTurn && gameState.turnPhase === 'draw'}
              />
            ) : (
              <div className="card card-eliminated"><span>Empty</span></div>
            )}
          </div>

          {/* Drawn card display */}
          {isMyTurn && gameState.turnPhase === 'action' && gameState.lastDrawnCard !== null && (
            <div className="drawn-card-area">
              <p className="pile-label">Drawn Card</p>
              <Card card={{ value: gameState.lastDrawnCard, revealed: true }} highlight />
              <div className="drawn-actions">
                <p>Replace a card on your grid, or:</p>
                <button className="btn-secondary" onClick={handleDiscardDrawn}>
                  Discard & Flip Instead
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Turn phase instructions */}
        {isMyTurn && (
          <div className="turn-instructions">
            {gameState.turnPhase === 'draw' && (
              <p>👆 Click the <strong>Draw Pile</strong> or <strong>Discard Pile</strong> to pick a card</p>
            )}
            {gameState.turnPhase === 'action' && (
              <p>👆 Click a card on your grid to <strong>replace it</strong>, or <strong>discard</strong> and flip a face-down card</p>
            )}
            {gameState.turnPhase === 'replace_discard' && (
              <p>👆 Click a card on your grid to <strong>replace it</strong> with the discard card</p>
            )}
            {gameState.turnPhase === 'flip' && (
              <p>👆 Click a <strong>face-down card</strong> on your grid to flip it</p>
            )}
          </div>
        )}

        {/* My cards */}
        <div className="my-area">
          <PlayerGrid
            player={myPlayer}
            isCurrentUser={true}
            onCardClick={handleCardClick}
            clickableCards={getClickableCards()}
          />
        </div>

        {/* Opponents */}
        <div className="opponents-area">
          {gameState.players
            .filter(p => p.userId !== user.id)
            .map(p => (
              <PlayerGrid
                key={p.userId}
                player={p}
                isCurrentUser={false}
                small
                highlight={p.userId === gameState.currentTurnUserId}
              />
            ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
