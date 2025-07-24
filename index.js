

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

// プライベートIPアドレスかどうかを判定する関数
function isPrivateIP(ip) {
  const parts = ip.split('.').map(part => parseInt(part, 10));  
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
    if (socket.handshake.query.isAdmin === "true") {
        return;
    }

  activeUsers++;

  // IPアドレスを取得（x-forwarded-forがあればそれを使用）
  let ips = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (typeof ips === 'string') {
    ips = ips.split(',').map(ip => ip.trim());
  } else {
    ips = [ips];
  }

  // 有効な公開IPアドレスを選択
  let selectedIp = null;
  for (const ip of ips) {
    if (ip && !isPrivateIP(ip)) {
      selectedIp = ip;
      break;
    }
  }

  // 有効なIPが見つからない場合は最初のIPを使用
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
    activeUsers--;
    const disconnectTime = new Date();

    if (userSessions[socket.id]) {
      userSessions[socket.id].disconnectTime = disconnectTime;
    }

    io.emit("updateUserCount", activeUsers);
    io.emit("userSessionsUpdate", userSessions);
  });
});
