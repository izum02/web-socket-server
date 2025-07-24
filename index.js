const { Server } = require("socket.io");

const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;

// ユーザー情報を管理するオブジェクト
// socket.id をキーにして { ip, connectTime, disconnectTime } を保存
const userSessions = {};

io.on("connection", (socket) => {
  activeUsers++;

  // IP取得（プロキシ環境を考慮）
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  const connectTime = new Date();

  // ユーザー情報保存
  userSessions[socket.id] = {
    ip,
    connectTime,
    disconnectTime: null,
  };

  console.log(`ユーザー接続: IP=${ip} 接続時間=${connectTime.toISOString()}`);
  console.log(`現在の接続数: ${activeUsers}`);

  io.emit("updateUserCount", activeUsers);

  socket.on("disconnect", () => {
    activeUsers--;

    const disconnectTime = new Date();

    if (userSessions[socket.id]) {
      userSessions[socket.id].disconnectTime = disconnectTime;

      // ここでログを出したり、DBに保存したりする処理を追加可能
      console.log(`ユーザー切断: IP=${userSessions[socket.id].ip} 開始=${userSessions[socket.id].connectTime.toISOString()} 終了=${disconnectTime.toISOString()}`);

      // 必要に応じてセッション削除
      delete userSessions[socket.id];
    }

    console.log(`現在の接続数: ${activeUsers}`);
    io.emit("updateUserCount", activeUsers);
  });
});
