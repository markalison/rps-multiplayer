const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this demo
        methods: ["GET", "POST"]
    }
});

let connectedPlayers = 0;
let matchmakingQueue = [];
let activeGames = {}; // roomId: { p1: socketId, p2: socketId, p1Move: null, p2Move: null }

io.on('connection', (socket) => {
    connectedPlayers++;
    io.emit('player_count', connectedPlayers);
    console.log(`User connected: ${socket.id}. Total: ${connectedPlayers}`);

    socket.on('find_match', () => {
        console.log(`User ${socket.id} looking for match`);
        if (matchmakingQueue.includes(socket.id)) return;

        matchmakingQueue.push(socket.id);

        if (matchmakingQueue.length >= 2) {
            const p1 = matchmakingQueue.shift();
            const p2 = matchmakingQueue.shift();
            const roomId = `game_${p1}_${p2}`;

            activeGames[roomId] = {
                p1,
                p2,
                p1Move: null,
                p2Move: null
            };

            // Join both to room
            const sock1 = io.sockets.sockets.get(p1);
            const sock2 = io.sockets.sockets.get(p2);

            if (sock1 && sock2) {
                sock1.join(roomId);
                sock2.join(roomId);

                io.to(roomId).emit('match_found', { roomId, opponent: 'opponent' });
                console.log(`Match found: ${p1} vs ${p2} in ${roomId}`);
            } else {
                // Handle disconnect during matching edge case
                if (sock1) matchmakingQueue.unshift(p1);
                if (sock2) matchmakingQueue.unshift(p2);
            }
        }
    });

    socket.on('make_move', ({ roomId, move }) => {
        const game = activeGames[roomId];
        if (!game) return;

        if (socket.id === game.p1) {
            game.p1Move = move;
        } else if (socket.id === game.p2) {
            game.p2Move = move;
        }

        // Check if both moved
        if (game.p1Move && game.p2Move) {
            const winner = determineWinner(game.p1Move, game.p2Move);
            let result = '';

            if (winner === 'draw') result = 'draw';
            else if (winner === 'p1') result = socket.id === game.p1 ? 'win' : 'lose';
            else result = socket.id === game.p2 ? 'win' : 'lose';

            // Send results individually so we can tell them if they won or lost relative to themselves
            io.to(game.p1).emit('game_result', {
                result: winner === 'draw' ? 'draw' : (winner === 'p1' ? 'win' : 'lose'),
                opponentMove: game.p2Move,
                myMove: game.p1Move
            });
            io.to(game.p2).emit('game_result', {
                result: winner === 'draw' ? 'draw' : (winner === 'p2' ? 'win' : 'lose'),
                opponentMove: game.p1Move,
                myMove: game.p2Move
            });

            // Reset moves for next round or end game? Let's just reset for now or user can leave
            delete activeGames[roomId]; // Single round for now? Or keep playing?
            // For this MVP, let's treat it as a single round match.
        }
    });

    socket.on('cancel_search', () => {
        matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);
    });

    socket.on('disconnect', () => {
        connectedPlayers--;
        io.emit('player_count', connectedPlayers);
        matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);
        console.log(`User disconnected: ${socket.id}`);

        // Handle active games disconnect?
        // A simplified approach: if in game, notify opponent
        for (const [roomId, game] of Object.entries(activeGames)) {
            if (game.p1 === socket.id || game.p2 === socket.id) {
                io.to(roomId).emit('opponent_disconnected');
                delete activeGames[roomId];
            }
        }
    });
});

function determineWinner(p1, p2) {
    if (p1 === p2) return 'draw';
    if (
        (p1 === 'rock' && p2 === 'scissors') ||
        (p1 === 'paper' && p2 === 'rock') ||
        (p1 === 'scissors' && p2 === 'paper')
    ) {
        return 'p1';
    }
    return 'p2';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
