import React from 'react';
import Card from './Card';

export default function PlayerGrid({ player, isCurrentUser, onCardClick, clickableCards, small }) {
  if (!player.cards) return null;

  return (
    <div className={`player-grid-container ${small ? 'small' : ''}`}>
      <div className="player-grid-header">
        <span className="player-grid-name">
          {player.username}
          {isCurrentUser && ' (you)'}
        </span>
        <span className="player-grid-score">
          Score: {player.totalGameScore}
          {player.roundScore > 0 && ` (+${player.roundScore})`}
        </span>
      </div>
      <div className="card-grid">
        {player.cards.map((row, rowIdx) => (
          <div key={rowIdx} className="card-row">
            {row.map((card, colIdx) => {
              const isClickable = clickableCards && isCurrentUser &&
                clickableCards(rowIdx, colIdx, card);
              return (
                <Card
                  key={colIdx}
                  card={card}
                  onClick={() => onCardClick && onCardClick(rowIdx, colIdx)}
                  clickable={isClickable}
                  small={small}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
