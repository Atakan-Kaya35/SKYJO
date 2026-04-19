import React, { useState, useEffect, useRef } from 'react';

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

export default function Card({ card, onClick, clickable, highlight, small, animState }) {
  // animState: null | 'flip' | { type: 'replace', oldValue, newValue }
  const [flipping, setFlipping] = useState(false);
  const [replacing, setReplacing] = useState(null); // { phase, oldValue, newValue }
  const prevRevealed = useRef(card?.revealed);

  // Detect when card transitions from hidden → revealed (flip animation)
  useEffect(() => {
    if (card && !prevRevealed.current && card.revealed && !animState) {
      setFlipping(true);
      const timer = setTimeout(() => setFlipping(false), 600);
      prevRevealed.current = card.revealed;
      return () => clearTimeout(timer);
    }
    prevRevealed.current = card?.revealed;
  }, [card?.revealed, animState]);

  // Handle explicit animation state from parent
  useEffect(() => {
    if (animState === 'flip') {
      setFlipping(true);
      const timer = setTimeout(() => setFlipping(false), 600);
      return () => clearTimeout(timer);
    }
    if (animState && animState.type === 'replace') {
      // Phase 1: show old card flipping up (0-600ms)
      setReplacing({ phase: 'flip-old', oldValue: animState.oldValue, newValue: animState.newValue });
      const t1 = setTimeout(() => {
        // Phase 2: old card revealed, new card glides in (600-1200ms)
        setReplacing({ phase: 'glide-new', oldValue: animState.oldValue, newValue: animState.newValue });
      }, 700);
      const t2 = setTimeout(() => {
        setReplacing(null);
      }, 1500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [animState]);

  if (card === null) {
    return <div className={`card card-eliminated ${small ? 'card-small' : ''}`} />;
  }

  // During replace animation
  if (replacing) {
    if (replacing.phase === 'flip-old') {
      const oldColor = CARD_COLORS[(replacing.oldValue ?? '').toString()] || '#666';
      return (
        <div className={`card-flip-container ${small ? 'card-small' : ''}`}>
          <div className="card-flip-inner card-flipping">
            <div className="card-flip-front card card-hidden" style={{}}>
              <span className="card-back">?</span>
            </div>
            <div className="card-flip-back card card-revealed" style={{ backgroundColor: oldColor }}>
              <span className="card-value">{replacing.oldValue}</span>
            </div>
          </div>
        </div>
      );
    }
    if (replacing.phase === 'glide-new') {
      const oldColor = CARD_COLORS[(replacing.oldValue ?? '').toString()] || '#666';
      const newColor = CARD_COLORS[(replacing.newValue ?? '').toString()] || '#666';
      return (
        <div className={`card-replace-container ${small ? 'card-small' : ''}`}>
          <div className="card card-revealed card-float-away" style={{ backgroundColor: oldColor }}>
            <span className="card-value">{replacing.oldValue}</span>
          </div>
          <div className="card card-revealed card-glide-in" style={{ backgroundColor: newColor }}>
            <span className="card-value">{replacing.newValue}</span>
          </div>
        </div>
      );
    }
  }

  const isRevealed = card.revealed;
  const value = card.value;
  const color = isRevealed && value !== null ? CARD_COLORS[value.toString()] || '#666' : '#1a1a2e';

  // Flip animation
  if (flipping && isRevealed) {
    return (
      <div className={`card-flip-container ${small ? 'card-small' : ''}`}>
        <div className="card-flip-inner card-flipping">
          <div className="card-flip-front card card-hidden">
            <span className="card-back">?</span>
          </div>
          <div className="card-flip-back card card-revealed" style={{ backgroundColor: color }}>
            <span className="card-value">{value}</span>
          </div>
        </div>
      </div>
    );
  }

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
