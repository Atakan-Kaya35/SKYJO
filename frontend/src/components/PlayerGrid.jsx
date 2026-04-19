import React from 'react';
import Card from './Card';

export default function PlayerGrid({ player, isCurrentUser, onCardClick, clickableCards, small, cardAnimations }) {
  if (!player.cards) return null;

  // Show visible score (sum of revealed cards) during gameplay, totalGameScore at round/game end
  const displayScore = player.visibleScore !== undefined ? player.visibleScore : player.totalGameScore;

  return (
    <div className={`player-grid-container ${small ? 'small' : ''}`}>
      <div className="player-grid-header">
        <span className="player-grid-name">
          {player.username}
          {isCurrentUser && ' (you)'}
        </span>
        <span className="player-grid-score">
          Visible: {displayScore}
          {player.totalGameScore > 0 && ` | Total: ${player.totalGameScore}`}
        </span>
      </div>
      <div className="card-grid">
        {player.cards.map((row, rowIdx) => (
          <div key={rowIdx} className="card-row">
            {row.map((card, colIdx) => {
              const isClickable = clickableCards && isCurrentUser &&
                clickableCards(rowIdx, colIdx, card);
              const animKey = `${rowIdx}-${colIdx}`;
              const animState = cardAnimations ? cardAnimations[animKey] : null;
              return (
                <Card
                  key={colIdx}
                  card={card}
                  onClick={() => onCardClick && onCardClick(rowIdx, colIdx)}
                  clickable={isClickable}
                  small={small}
                  animState={animState}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
