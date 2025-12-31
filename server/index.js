const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Data Stores
let connectedPlayers = 0;
let matchmakingQueue = [];
let activeGames = {}; // roomId: { p1, p2, p1Move, p2Move }
let players = {}; // socketId: { username, score, wins }
let matchHistory = []; // { id, winner, loser, winnerMove, loserMove, timestamp }

// Random Name Generator
const PREFIXES = ['Neon', 'Cyber', 'Shadow', 'Cosmic', 'Pixel', 'Rapid', 'Turbo', 'Iron', 'Solar', 'Atomic'];
const SUFFIXES = ['Ninja', 'Wolf', 'Hawk', 'Viper', 'Ghost', 'Knight', 'Storm', 'Falcon', 'Raven', 'Tiger'];

function generateName() {
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const num = Math.floor(Math.random() * 100);
    return `${prefix}${suffix}${num}`;
}

io.on('connection', (socket) => {
    connectedPlayers++;

    // Assign Random Name
    const username = generateName();
    players[socket.id] = {
        username,
        score: 0,
        wins: 0
    };

    console.log(`User connected: ${socket.id} assigned ${username}`);

    // Send Initial Data
    io.emit('player_count', connectedPlayers);
    socket.emit('your_profile', players[socket.id]);
    socket.emit('leaderboard_update', getLeaderboard());
    socket.emit('history_update', matchHistory.slice(0, 5)); // Send last 5

    socket.on('find_match', () => {
        if (matchmakingQueue.includes(socket.id)) return;
        matchmakingQueue.push(socket.id);

        if (matchmakingQueue.length >= 2) {
            const p1 = matchmakingQueue.shift();
            const p2 = matchmakingQueue.shift();
            const roomId = `game_${p1}_${p2}`;

            activeGames[roomId] = { p1, p2, p1Move: null, p2Move: null };

            const sock1 = io.sockets.sockets.get(p1);
            const sock2 = io.sockets.sockets.get(p2);

            if (sock1 && sock2) {
                sock1.join(roomId);
                sock2.join(roomId);

                // Send opponent info
                io.to(p1).emit('match_found', { roomId, opponentName: players[p2].username });
                io.to(p2).emit('match_found', { roomId, opponentName: players[p1].username });
            } else {
                if (sock1) matchmakingQueue.unshift(p1);
                if (sock2) matchmakingQueue.unshift(p2);
            }
        }
    });

    socket.on('make_move', ({ roomId, move }) => {
        const game = activeGames[roomId];
        if (!game) return;

        if (socket.id === game.p1) game.p1Move = move;
        else if (socket.id === game.p2) game.p2Move = move;

        if (game.p1Move && game.p2Move) {
            const winner = determineWinner(game.p1Move, game.p2Move);
            let p1Result = 'draw';
            let p2Result = 'draw';

            if (winner === 'p1') {
                p1Result = 'win';
                p2Result = 'lose';
                updateStats(game.p1, game.p2);
                recordHistory(game.p1, game.p2, game.p1Move, game.p2Move);
            } else if (winner === 'p2') {
                p1Result = 'lose';
                p2Result = 'win';
                updateStats(game.p2, game.p1);
                recordHistory(game.p2, game.p1, game.p2Move, game.p1Move);
            }

            // Broadcast new data
            io.emit('leaderboard_update', getLeaderboard());
            io.emit('history_update', matchHistory.slice(0, 5));

            // Send Game Results with updated profiles
            io.to(game.p1).emit('game_result', {
                result: p1Result,
                opponentMove: game.p2Move,
                newScore: players[game.p1].score
            });
            io.to(game.p2).emit('game_result', {
                result: p2Result,
                opponentMove: game.p1Move,
                newScore: players[game.p2].score
            });

            delete activeGames[roomId];
        }
    });

    socket.on('cancel_search', () => {
        matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);
    });

    socket.on('disconnect', () => {
        connectedPlayers--;
        delete players[socket.id]; // Remove from leaderboard on disconnect? Or keep? 
        // For simple connection-based leaderboard, removing keeps it clean for "Active Players"

        io.emit('player_count', connectedPlayers);
        io.emit('leaderboard_update', getLeaderboard());

        matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);

        // Clean active games
        for (const [roomId, game] of Object.entries(activeGames)) {
            if (game.p1 === socket.id || game.p2 === socket.id) {
                io.to(roomId).emit('opponent_disconnected');
                delete activeGames[roomId];
            }
        }
    });
});

function determineWinner(m1, m2) {
    if (m1 === m2) return 'draw';
    if ((m1 === 'rock' && m2 === 'scissors') ||
        (m1 === 'paper' && m2 === 'rock') ||
        (m1 === 'scissors' && m2 === 'paper')) return 'p1';
    return 'p2';
}

function updateStats(winnerId, loserId) {
    if (players[winnerId]) {
        players[winnerId].score += 10;
        players[winnerId].wins += 1;
    }
    // Optional: Deduct points for loser?
}

function recordHistory(winnerId, loserId, winMove, loseMove) {
    const winnerName = players[winnerId]?.username || 'Unknown';
    const loserName = players[loserId]?.username || 'Unknown';

    matchHistory.unshift({
        id: Date.now(),
        winner: winnerName,
        loser: loserName,
        winMove,
        loseMove
    });

    if (matchHistory.length > 20) matchHistory.pop(); // Keep limit
}

function getLeaderboard() {
    return Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Top 5
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
