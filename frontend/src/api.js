// ============================================================
// API Service - communicates with the SKYJO backend
// ============================================================

// IMPORTANT: Change this to your Render.com service URL after deploying
const API_BASE = process.env.REACT_APP_API_URL || 'https://skyjo-x831.onrender.com';

function getHeaders(userId) {
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['x-user-id'] = userId.toString();
  return headers;
}

// ---- Auth ----
export async function login(username) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function getLeaderboard() {
  const res = await fetch(`${API_BASE}/api/auth/leaderboard`);
  return res.json();
}

// ---- Lobby ----
export async function getLobbyState(userId) {
  const res = await fetch(`${API_BASE}/api/lobby/state`, {
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function joinLobby(userId) {
  const res = await fetch(`${API_BASE}/api/lobby/join`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function leaveLobby(userId) {
  const res = await fetch(`${API_BASE}/api/lobby/leave`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function toggleReady(userId) {
  const res = await fetch(`${API_BASE}/api/lobby/ready`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function setRequiredPlayers(userId, requiredPlayers) {
  const res = await fetch(`${API_BASE}/api/lobby/set-players`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ requiredPlayers }),
  });
  return res.json();
}

export async function startGame(userId) {
  const res = await fetch(`${API_BASE}/api/lobby/start-game`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}

// ---- Game ----
export async function getGameState(userId) {
  const res = await fetch(`${API_BASE}/api/game/state`, {
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function initialFlip(userId, row, col) {
  const res = await fetch(`${API_BASE}/api/game/initial-flip`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ row, col }),
  });
  return res.json();
}

export async function drawCard(userId, source) {
  const res = await fetch(`${API_BASE}/api/game/draw`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ source }),
  });
  return res.json();
}

export async function replaceCard(userId, row, col) {
  const res = await fetch(`${API_BASE}/api/game/replace`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ row, col }),
  });
  return res.json();
}

export async function discardDrawn(userId) {
  const res = await fetch(`${API_BASE}/api/game/discard-drawn`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}

export async function flipCard(userId, row, col) {
  const res = await fetch(`${API_BASE}/api/game/flip`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ row, col }),
  });
  return res.json();
}

export async function returnToLobby(userId) {
  const res = await fetch(`${API_BASE}/api/game/return-to-lobby`, {
    method: 'POST',
    headers: getHeaders(userId),
  });
  return res.json();
}
