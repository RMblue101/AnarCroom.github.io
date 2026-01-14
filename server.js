const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

const rooms = {};

// Endpoint para testar se servidor está online
app.get('/', (req, res) => res.send('✅ Anarchroom Server online'));

// WebSocket Events
io.on('connection', (socket) => {
  console.log('Novo socket:', socket.id);

  // Utilizador entra numa sala
  socket.on('entrarSala', ({ room, user }) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = { users: {}, messages: [] };
    rooms[room].users[user] = { id: socket.id, lastSeen: Date.now() };
    io.to(room).emit('atualizarOnline', Object.keys(rooms[room].users).length);
    io.to(room).emit('usuarioEntrou', user);
    socket.emit('carregarMensagens', rooms[room].messages);
  });

  // Receber mensagem
  socket.on('enviarMensagem', ({ room, user, msg, time }) => {
    if (!rooms[room]) rooms[room] = { users: {}, messages: [] };
    const newMsg = { user, msg, time };
    rooms[room].messages.push(newMsg);
    if (rooms[room].messages.length > 500) rooms[room].messages.shift();
    io.to(room).emit('mensagem', newMsg);
  });

  // Utilizador sai da sala
  socket.on('sairSala', ({ room, user }) => {
    socket.leave(room);
    if (rooms[room]) {
      delete rooms[room].users[user];
      if (Object.keys(rooms[room].users).length === 0) delete rooms[room];
      else io.to(room).emit('atualizarOnline', Object.keys(rooms[room].users).length);
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(room => {
      Object.keys(rooms[room].users).forEach(user => {
        if (rooms[room].users[user].id === socket.id) {
          delete rooms[room].users[user];
          io.to(room).emit('atualizarOnline', Object.keys(rooms[room].users).length);
        }
      });
      if (Object.keys(rooms[room].users).length === 0) delete rooms[room];
    });
    console.log('Socket desconectado:', socket.id);
  });

  // Heartbeat para manter conexão viva
  socket.on('heartbeat', ({ room, user }) => {
    if (rooms[room] && rooms[room].users[user]) rooms[room].users[user].lastSeen = Date.now();
  });
});

// Limpar salas inativas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutos
  Object.keys(rooms).forEach(room => {
    Object.keys(rooms[room].users).forEach(user => {
      if (now - (rooms[room].users[user].lastSeen || 0) > timeout) {
        delete rooms[room].users[user];
      }
    });
    if (Object.keys(rooms[room].users).length === 0) delete rooms[room];
  });
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Anarchroom Server em http://localhost:${PORT}`));
