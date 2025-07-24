const { Server } = require("socket.io");

const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;
const userSessions = {};

io.on("connection", (socket) => {
  activeUsers++;

  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const connectTime = new Date();

  userSessions[socket.id] = {
    ip,
    connectTime,
    disconnectTime: null,
  };

  io.emit("updateUserCount", activeUsers);
  io.emit("userSessionsUpdate", userSessions); // ここで全クライアントに送る

  socket.on("disconnect", () => {
    activeUsers--;
    const disconnectTime = new Date();

    if (userSessions[socket.id]) {
      userSessions[socket.id].disconnectTime = disconnectTime;
    }

    io.emit("updateUserCount", activeUsers);
    io.emit("userSessionsUpdate", userSessions); // 更新を通知

    // 必要ならセッションを残すか削除するか判断
    // 今回は残しておく例です
  });
});
