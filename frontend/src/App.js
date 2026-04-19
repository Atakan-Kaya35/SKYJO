import React, { useState } from 'react';
import { LanguageProvider } from './LanguageContext';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Game from './components/Game';

function AppContent() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('skyjo_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [screen, setScreen] = useState('lobby'); // 'lobby' | 'game'

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('skyjo_user', JSON.stringify(userData));
    setScreen('lobby');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('skyjo_user');
    setScreen('lobby');
  };

  const handleGameStart = () => {
    setScreen('game');
  };

  const handleReturnToLobby = () => {
    setScreen('lobby');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (screen === 'game') {
    return <Game user={user} onReturnToLobby={handleReturnToLobby} />;
  }

  return (
    <Lobby
      user={user}
      onGameStart={handleGameStart}
      onLogout={handleLogout}
    />
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
