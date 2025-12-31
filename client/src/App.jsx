import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Users, Hand, Scissors, Scroll, Trophy, XCircle, MinusCircle, User, Activity } from 'lucide-react';
import './index.css';

const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

function App() {
  const [gameState, setGameState] = useState('LANDING');
  const [playerCount, setPlayerCount] = useState(0);
  const [roomId, setRoomId] = useState(null);

  // Game Data
  const [myProfile, setMyProfile] = useState({ username: 'Loading...', score: 0 });
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);

  // Match Data
  const [opponentName, setOpponentName] = useState('Opponent');
  const [myMove, setMyMove] = useState(null);
  const [result, setResult] = useState(null);
  const [opponentMove, setOpponentMove] = useState(null);

  useEffect(() => {
    socket.on('player_count', (count) => setPlayerCount(count));

    socket.on('your_profile', (profile) => setMyProfile(profile));

    socket.on('leaderboard_update', (data) => setLeaderboard(data));
    socket.on('history_update', (data) => setHistory(data));

    socket.on('match_found', ({ roomId, opponentName }) => {
      setRoomId(roomId);
      setOpponentName(opponentName);
      setGameState('PLAYING');
    });

    socket.on('game_result', (data) => {
      setResult(data.result);
      setOpponentMove(data.opponentMove);
      if (data.newScore !== undefined) {
        setMyProfile(prev => ({ ...prev, score: data.newScore }));
      }
      setGameState('RESULT');
    });

    socket.on('opponent_disconnected', () => {
      alert('Opponent disconnected!');
      resetGame();
    });

    return () => {
      socket.off('player_count');
      socket.off('your_profile');
      socket.off('leaderboard_update');
      socket.off('history_update');
      socket.off('match_found');
      socket.off('game_result');
      socket.off('opponent_disconnected');
    };
  }, []);

  const findMatch = () => {
    setGameState('SEARCHING');
    socket.emit('find_match');
  };

  const cancelSearch = () => {
    setGameState('LANDING');
    socket.emit('cancel_search');
  };

  const makeMove = (move) => {
    setMyMove(move);
    socket.emit('make_move', { roomId, move });
  };

  const resetGame = () => {
    setGameState('LANDING');
    setRoomId(null);
    setMyMove(null);
    setResult(null);
    setOpponentMove(null);
  };

  return (
    <>
      {gameState === 'LANDING' && (
        <div className="container" style={{ maxWidth: '800px' }}>
          <h1 className="title">RPS ARENA</h1>

          <div className="profile-card">
            <User size={24} color="var(--accent-color)" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>PLAYING AS</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{myProfile.username}</span>
            </div>
            <div style={{ marginLeft: 'auto', background: '#000', padding: '0.5rem', borderRadius: '8px' }}>
              <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{myProfile.score} PTS</span>
            </div>
          </div>

          <div className="status-badge" style={{ marginBottom: '2rem' }}>
            <Users size={18} />
            <span>{playerCount} Players Online</span>
          </div>

          <button className="play-btn" onClick={findMatch}>
            FIND MATCH
          </button>

          <div className="dashboard-grid">
            <div className="dashboard-panel">
              <h3><Trophy size={16} /> LEADERBOARD</h3>
              {leaderboard.length === 0 ? <p className="empty-text">No active players</p> : (
                <div className="list">
                  {leaderboard.map((p, i) => (
                    <div key={i} className="list-item">
                      <span className="rank">#{i + 1}</span>
                      <span className="name">{p.username}</span>
                      <span className="score">{p.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-panel">
              <h3><Activity size={16} /> RECENT BATTLES</h3>
              {history.length === 0 ? <p className="empty-text">No matches yet</p> : (
                <div className="list">
                  {history.map((h, i) => (
                    <div key={h.id} className="list-item history-item">
                      <span className="winner">{h.winner}</span>
                      <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>def.</span>
                      <span className="loser">{h.loser}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {gameState === 'SEARCHING' && (
        <div className="container">
          <h2 className="title">SEARCHING...</h2>
          <span className="loader"></span>
          <p style={{ opacity: 0.7 }}>Finding a worthy opponent for {myProfile.username}</p>
          <button onClick={cancelSearch} style={{ marginTop: '2rem', background: 'transparent', border: '1px solid #333' }}>
            Cancel
          </button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="container">
          <div className="status-badge">VS {opponentName}</div>
          <h2 style={{ fontSize: '2rem', margin: '1rem 0 2rem 0' }}>CHOOSE YOUR WEAPON</h2>

          <div className="choice-grid">
            <div
              className={`choice-card ${myMove === 'rock' ? 'selected' : ''}`}
              onClick={() => !myMove && makeMove('rock')}
              style={{ opacity: myMove && myMove !== 'rock' ? 0.5 : 1 }}
            >
              <Hand className="choice-icon" />
              <span>ROCK</span>
            </div>

            <div
              className={`choice-card ${myMove === 'paper' ? 'selected' : ''}`}
              onClick={() => !myMove && makeMove('paper')}
              style={{ opacity: myMove && myMove !== 'paper' ? 0.5 : 1 }}
            >
              <Scroll className="choice-icon" />
              <span>PAPER</span>
            </div>

            <div
              className={`choice-card ${myMove === 'scissors' ? 'selected' : ''}`}
              onClick={() => !myMove && makeMove('scissors')}
              style={{ opacity: myMove && myMove !== 'scissors' ? 0.5 : 1 }}
            >
              <Scissors className="choice-icon" />
              <span>SCISSORS</span>
            </div>
          </div>
        </div>
      )}

      {gameState === 'RESULT' && (
        <div className="container">
          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>
            {result === 'win' && <Trophy size={80} color="var(--accent-color)" />}
            {result === 'lose' && <XCircle size={80} color="var(--secondary-color)" />}
            {result === 'draw' && <MinusCircle size={80} color="white" />}
          </div>

          <h1 className={`result-text ${result}`}>YOU {result === 'draw' ? 'DREW' : (result === 'win' ? 'WON' : 'LOST')}</h1>

          <div style={{ display: 'flex', gap: '2rem', margin: '2rem 0', textAlign: 'center' }}>
            <div>
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>YOU ({myProfile.username})</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{myMove}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>{opponentName}</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{opponentMove}</div>
            </div>
          </div>

          <button className="play-btn" onClick={resetGame} style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
            CONTINUE
          </button>
        </div>
      )}
    </>
  );
}

export default App;
