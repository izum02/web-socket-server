const { Server } = require("socket.io");

// Node.js 18+ならfetchは標準搭載
const port = process.env.PORT || 3000;
const io = new Server(port, {
  cors: {
    origin: "*",
  }
});

let activeUsers = 0;
const userSessions = {}; // 現在のセッション
const userSessionHistory = []; // 過去のセッション履歴も含む

// プライベートIPアドレスかどうかを判定する関数
function isPrivateIP(ip) {
  const parts = ip.split('.').map(part => parseInt(part, 10));
  if (parts.length !== 4) return false;
  const [a, b] = parts;

  return (
    a === 10 || // 10.0.0.0/8
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    a === 127 || // 127.0.0.1 (loopback)
    a === 0 // 0.0.0.0 (unspecified)
  );
}

async function fetchIpInfo(ip) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') {
      console.error("IP info fetch timed out for IP:", ip);
    } else {
      console.error("IP info fetch failed:", e);
    }
    return null;
  }
}

io.on("connection", async (socket) => {
  if (socket.handshake.query.isAdmin === "true") {
    return;
  }

  console.log(`New connection from ${socket.id}, isAdmin: ${socket.handshake.query.isAdmin}`);

  activeUsers++;

  // IPアドレスを取得
  let ips = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (typeof ips === 'string') {
    ips = ips.split(',').map(ip => ip.trim());
  } else {
    ips = [ips];
  }

  const ipString = ips.join(', '); // 全IPをカンマ区切りで保存
  const connectTime = new Date();

  userSessions[socket.id] = {
    ip: ipString, // 全部のIPアドレス
    connectTime,
    disconnectTime: null,
    loc: null,
    city: null,
    region: null,
    country: null,
  };

  // 最初の公開IPだけをAPIに渡す
  const firstPublicIp = ips.find(ip => ip && !isPrivateIP(ip));
  if (firstPublicIp) {
    const ipInfo = await fetchIpInfo(firstPublicIp);
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

      // 履歴にも保存
      userSessionHistory.push({ ...userSessions[socket.id] });

      // ※ 現在のセッション情報も保持するので削除しません（形式を維持）
    }

    io.emit("updateUserCount", activeUsers);
    io.emit("userSessionsUpdate", userSessions);
  });
});
