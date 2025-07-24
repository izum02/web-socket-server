const { Server } = require("socket.io");

const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;
const userSessions = {};

function isPrivateIP(ip) {
  const parts = ip.split('.').map(part => parseInt(part, 10));
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

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
  // 管理画面からの接続は記録しない
  if (socket.handshake.query.isAdmin) {
    return;
  }

  activeUsers++;

  let ips = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (typeof ips === 'string') {
    ips = ips.split(',').map(ip => ip.trim());
  } else {
    ips = [ips];
  }

  let selectedIp = null;
  for (const ip of ips) {
    if (ip && !isPrivateIP(ip)) {
      selectedIp = ip;
      break;
    }
  }

  if (!selectedIp && ips.length > 0) {
    selectedIp = ips[0];
  }

  const connectTime = new Date();

  userSessions[socket.id] = {
    ip: selectedIp,
    connectTime,
    disconnectTime: null,
    loc: null,
    city: null,
    region: null,
    country: null,
  };

  if (selectedIp && !isPrivateIP(selectedIp)) {
    const ipInfo = await fetchIpInfo(selectedIp);
    if (ipInfo) {
      userSessions[socket.id].loc = ipInfo.loc || null;
      userSessions[socket.id].city = ipInfo.city || null;
      userSessions[socket.id].region = ipInfo.region || null;
      userSessions[socket.id].country = ipInfo.country || null;
    }
  }

  io.emit("updateUserCount", activeUsers);
  io.emit("userSessionsUpdate", userSessions);

  socket.on("disconnect", () => {
    // 管理画面からの切断は無視
    if (socket.handshake.query.isAdmin) {
      return;
    }

    activeUsers--;
    const disconnectTime = new Date();

    if (userSessions[socket.id]) {
      userSessions[socket.id].disconnectTime = disconnectTime;
    }

    io.emit("updateUserCount", activeUsers);
    io.emit("userSessionsUpdate", userSessions);
  });
});
