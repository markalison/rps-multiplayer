import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Users, Hand, Scissors, Scroll, Trophy, XCircle, MinusCircle, ShieldAlert } from 'lucide-react';
import './index.css';

// Connect to backend (environment variable or localhost fallback)
const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

function App() {
  const [gameState, setGameState] = useState('LANDING'); // LANDING, SEARCHING, PLAYING, RESULT
  const [playerCount, setPlayerCount] = useState(0);
  const [roomId, setRoomId] = useState(null);
  const [myMove, setMyMove] = useState(null);
  const [result, setResult] = useState(null); // 'win', 'lose', 'draw'
  const [opponentMove, setOpponentMove] = useState(null);

  useEffect(() => {
    socket.on('player_count', (count) => setPlayerCount(count));

    socket.on('match_found', ({ roomId }) => {
      setRoomId(roomId);
      setGameState('PLAYING');
    });

    socket.on('game_result', (data) => {
      setResult(data.result);
      setOpponentMove(data.opponentMove);
      setGameState('RESULT');
    });

    socket.on('opponent_disconnected', () => {
      alert('Opponent disconnected!');
      resetGame();
    });

    return () => {
      socket.off('player_count');
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
        <div className="container">
          <h1 className="title">RPS ARENA</h1>
          <div className="status-badge">
            <Users size={18} />
            <span>{playerCount} Players Online</span>
          </div>
          <button className="play-btn" onClick={findMatch}>
            PLAY NOW
          </button>
        </div>
      )}

      {gameState === 'SEARCHING' && (
        <div className="container">
          <h2 className="title">SEARCHING...</h2>
          <span className="loader"></span>
          <p style={{ opacity: 0.7 }}>Finding a worthy opponent</p>
          <button onClick={cancelSearch} style={{ marginTop: '2rem', background: 'transparent', border: '1px solid #333' }}>
            Cancel
          </button>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <div className="container">
          <div className="status-badge">MATCH IN PROGRESS</div>
          <h2 style={{ fontSize: '2rem', margin: '0 0 2rem 0' }}>CHOOSE YOUR WEAPON</h2>

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

          {myMove && <p style={{ marginTop: '2rem', color: 'var(--accent-color)' }}>Waiting for opponent...</p>}
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
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>YOU CHOSE</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{myMove}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            <div>
              <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>OPPONENT CHOSE</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{opponentMove}</div>
            </div>
          </div>

          <button className="play-btn" onClick={resetGame} style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
            PLAY AGAIN
          </button>
        </div>
      )}
    </>
  );
}

export default App;
