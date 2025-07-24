const { Server } = require("socket.io");

// Node.js 18+ は fetch が組み込み済み

const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;
const userSessions = {};

// IP取得関数（x-forwarded-for 対応 & IPv6マッピング対応）
function getClientIp(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0]; // 最初のIP（一般的にクライアント）
  }
  return socket.handshake.address;
}

function normalizeIp(ip) {
  return ip?.replace(/^::ffff:/, '') ?? '';
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
  activeUsers++;

  const rawIp = getClientIp(socket);
  const ip = normalizeIp(rawIp);
  const connectTime = new Date();

  console.log("接続IP:", ip);

  // 初期情報セット
  userSessions[socket.id] = {
    ip,
    connectTime,
    disconnectTime: null,
    loc: null,
    city: null,
    region: null,
    country: null,
  };

  // IP情報取得（非同期）
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

    // セッション情報を削除するか保持するかは必要に応じて
    // delete userSessions[socket.id];
  });
});
