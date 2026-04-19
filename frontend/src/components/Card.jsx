import React from 'react';

const CARD_COLORS = {
  '-2': '#2196F3',
  '-1': '#03A9F4',
  '0': '#00BCD4',
  '1': '#4CAF50',
  '2': '#4CAF50',
  '3': '#8BC34A',
  '4': '#8BC34A',
  '5': '#FFC107',
  '6': '#FFC107',
  '7': '#FF9800',
  '8': '#FF9800',
  '9': '#FF5722',
  '10': '#FF5722',
  '11': '#F44336',
  '12': '#F44336',
};

export default function Card({ card, onClick, clickable, highlight, small }) {
  if (card === null) {
    return <div className={`card card-eliminated ${small ? 'card-small' : ''}`} />;
  }

  const isRevealed = card.revealed;
  const value = card.value;
  const color = isRevealed && value !== null ? CARD_COLORS[value.toString()] || '#666' : '#1a1a2e';

  return (
    <div
      className={`card ${isRevealed ? 'card-revealed' : 'card-hidden'} ${clickable ? 'card-clickable' : ''} ${highlight ? 'card-highlight' : ''} ${small ? 'card-small' : ''}`}
      style={isRevealed ? { backgroundColor: color } : {}}
      onClick={clickable ? onClick : undefined}
    >
      {isRevealed && value !== null ? (
        <span className="card-value">{value}</span>
      ) : (
        <span className="card-back">?</span>
      )}
    </div>
  );
}
