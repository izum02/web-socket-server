const { Server } = require("socket.io");

// Node.js 18+ならfetchは標準搭載
const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;
const userSessions = {};

async function fetchIpInfo(ip) {
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("IP情報取得失敗:", e);
    return null;
  }
}

io.on("connection", async (socket) => {
  activeUsers++;

  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const connectTime = new Date();

  userSessions[socket.id] = {
    ip,
    connectTime,
    disconnectTime: null,
    loc: null,
    city: null,
    region: null,
    country: null,
  };

  const ipInfo = await fetchIpInfo(ip);
  if (ipInfo) {
    userSessions[socket.id].loc = ipInfo.loc || null;
    userSessions[socket.id].city = ipInfo.city || null;
    userSessions[socket.id].region = ipInfo.region || null;
    userSessions[socket.id].country = ipInfo.country || null;
  }

  io.emit("updateUserCount", activeUsers);
  io.emit("userSessionsUpdate", userSessions);

  socket.on("disconnect", () => {
    activeUsers--;
    const disconnectTime = new Date();

    if (userSessions[socket.id]) {
      userSessions[socket.id].disconnectTime = disconnectTime;
    }

    io.emit("updateUserCount", activeUsers);
    io.emit("userSessionsUpdate", userSessions);
  });
});
