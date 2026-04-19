import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import { useLanguage } from '../LanguageContext';
import Card from './Card';
import PlayerGrid from './PlayerGrid';
import LanguageToggle from './LanguageToggle';

export default function Game({ user, onReturnToLobby }) {
  const { t } = useLanguage();
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [cardAnimations, setCardAnimations] = useState({}); // { "row-col": animState }

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
    return <div className="game-container"><p>{t.loadingGame}</p></div>;
  }

  const myPlayer = gameState.players.find(p => p.userId === user.id);
  const isMyTurn = gameState.currentTurnUserId === user.id;
  const isHost = gameState.hostUserId === user.id;
  const currentTurnPlayer = gameState.players.find(
    p => p.userId === gameState.currentTurnUserId
  );

  // ---- Trigger animation then clear after delay ----
  const triggerAnimation = (row, col, animState) => {
    const key = `${row}-${col}`;
    setCardAnimations(prev => ({ ...prev, [key]: animState }));
    setTimeout(() => {
      setCardAnimations(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1600);
  };

  // ---- Action handlers ----
  const doAction = async (actionFn, onResult) => {
    setActionLoading(true);
    setError('');
    try {
      const result = await actionFn();
      if (result.error) {
        setError(result.error);
      } else if (onResult) {
        onResult(result);
      }
      await fetchState();
    } catch (err) {
      setError(t.actionFailed);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInitialFlip = (row, col) => {
    doAction(() => api.initialFlip(user.id, row, col), () => {
      triggerAnimation(row, col, 'flip');
    });
  };

  const handleDraw = (source) => {
    doAction(() => api.drawCard(user.id, source));
  };

  const handleReplace = (row, col) => {
    // Get the old card before replacing (it's the current card at this position)
    const oldCard = myPlayer?.cards?.[row]?.[col];
    doAction(() => api.replaceCard(user.id, row, col), (result) => {
      if (result.oldCard) {
        triggerAnimation(row, col, {
          type: 'replace',
          oldValue: result.oldCard.value,
          newValue: result.newCard.value,
        });
      }
    });
  };

  const handleDiscardDrawn = () => {
    doAction(() => api.discardDrawn(user.id));
  };

  const handleFlip = (row, col) => {
    doAction(() => api.flipCard(user.id, row, col), (result) => {
      triggerAnimation(row, col, 'flip');
    });
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

  const handleTerminateGame = () => {
    if (window.confirm(t.terminateConfirm)) {
      doAction(() => api.terminateGame(user.id));
    }
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
        <LanguageToggle />
        <div className="game-header">
          <h2>{t.initialFlip}</h2>
          <p className="instruction">
            {myPlayer.initialFlipsDone >= 2
              ? t.waitingFlip
              : t.flipMore(2 - myPlayer.initialFlipsDone)}
          </p>
        </div>

        <div className="game-board">
          <div className="my-area">
            <PlayerGrid
              player={myPlayer}
              isCurrentUser={true}
              onCardClick={handleCardClick}
              clickableCards={getClickableCards()}
              cardAnimations={cardAnimations}
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
        <LanguageToggle />
        <div className="round-end">
          <h2>{t.roundComplete(gameState.roundNumber)}</h2>

          {gameState.roundEnderId && (
            <p className="round-ender-info">
              {t.endedRound(gameState.players.find(p => p.userId === gameState.roundEnderId)?.username)}
            </p>
          )}

          <div className="scoreboard">
            <table>
              <thead>
                <tr>
                  <th>{t.rank}</th>
                  <th>{t.player}</th>
                  <th>{t.roundScore}</th>
                  <th>{t.totalScoreHeader}</th>
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
              {myPlayer?.isReady ? t.unready : t.readyNextRound}
            </button>

            {isHost && allReady && (
              <button className="btn-start" onClick={handleStartNextRound}>
                {t.startNextRound}
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
        <LanguageToggle />
        <div className="game-over">
          <h2>{t.gameOver}</h2>
          <p className="winner-text">
            {t.winnerText(winner.username, winner.totalGameScore)}
          </p>

          <div className="scoreboard">
            <table>
              <thead>
                <tr>
                  <th>{t.rankHeader}</th>
                  <th>{t.player}</th>
                  <th>{t.finalScore}</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.userId} className={p.userId === user.id ? 'my-row' : ''}>
                    <td>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</td>
                    <td>{p.username}{p.userId === user.id ? ` ${t.you}` : ''}</td>
                    <td>{p.totalGameScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isHost && (
            <div className="lobby-actions">
              <button className="btn-primary" onClick={handleReturnToLobby}>
                {t.returnToLobby}
              </button>
            </div>
          )}

          {!isHost && (
            <p className="waiting-msg">{t.waitingHost}</p>
          )}

          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  // ---- Render: Playing Phase ----
  return (
    <div className="game-container">
      <LanguageToggle />
      <div className="game-header">
        <h2>{t.skyjoRound(gameState.roundNumber)}</h2>
        <div className="turn-info">
          {isMyTurn ? (
            <span className="your-turn">{t.yourTurn}</span>
          ) : (
            <span className="waiting-turn">
              {t.waitingFor(currentTurnPlayer?.username)}
            </span>
          )}
          {gameState.finalTurnsRemaining > 0 && (
            <span className="final-turns">{t.finalTurns(gameState.finalTurnsRemaining)}</span>
          )}
        </div>
      </div>

      <div className="game-board">
        {/* Draw & Discard piles */}
        <div className="piles-area">
          <div className="pile">
            <p className="pile-label">{t.drawPile} ({gameState.drawPileCount})</p>
            <div
              className={`card card-hidden ${isMyTurn && gameState.turnPhase === 'draw' ? 'card-clickable' : ''}`}
              onClick={() => isMyTurn && gameState.turnPhase === 'draw' && handleDraw('draw')}
            >
              <span className="card-back">🂠</span>
            </div>
          </div>

          <div className="pile">
            <p className="pile-label">{t.discardPile}</p>
            {gameState.topDiscard !== null && gameState.topDiscard !== undefined ? (
              <Card
                card={{ value: gameState.topDiscard, revealed: true }}
                onClick={() => isMyTurn && gameState.turnPhase === 'draw' && handleDraw('discard')}
                clickable={isMyTurn && gameState.turnPhase === 'draw'}
              />
            ) : (
              <div className="card card-eliminated"><span>{t.empty}</span></div>
            )}
          </div>

          {/* Drawn card display */}
          {isMyTurn && gameState.turnPhase === 'action' && gameState.lastDrawnCard !== null && (
            <div className="drawn-card-area">
              <p className="pile-label">{t.drawnCard}</p>
              <Card card={{ value: gameState.lastDrawnCard, revealed: true }} highlight />
              <div className="drawn-actions">
                <p>{t.replaceOrDiscard}</p>
                <button className="btn-secondary" onClick={handleDiscardDrawn}>
                  {t.discardFlip}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Turn phase instructions */}
        {isMyTurn && (
          <div className="turn-instructions">
            {gameState.turnPhase === 'draw' && (
              <p>👆 {t.instrDraw}</p>
            )}
            {gameState.turnPhase === 'action' && (
              <p>👆 {t.instrAction}</p>
            )}
            {gameState.turnPhase === 'replace_discard' && (
              <p>👆 {t.instrReplaceDiscard}</p>
            )}
            {gameState.turnPhase === 'flip' && (
              <p>👆 {t.instrFlip}</p>
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
            cardAnimations={cardAnimations}
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

      {/* Host terminate button */}
      {isHost && (
        <div className="admin-controls">
          <button className="btn-danger" onClick={handleTerminateGame}>
            {t.terminateGame}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
