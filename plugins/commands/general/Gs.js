import axios from "axios";

const config = {
  name: "gs",
  description: "Track Grow A Garden stock every 5 minutes and notify only if updated. Use 'gs refresh' to manually refresh stock data.",
  usage: "gs on | gs off | gs refresh",
  cooldown: 3,
  permissions: [0],
  credits: "Converted by Me with ChatGPT"
};

const activeSessions = new Map();

function getPHTime(isoString) {
  return new Date(isoString).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    weekday: "short"
  });
}

async function fetchStock() {
  const [allRes, weatherRes] = await Promise.all([
    axios.get("https://growagardenstock.vercel.app/api/stock/all"),
    axios.get("https://growagardenstock.vercel.app/api/weather")
  ]);

  return {
    gear: allRes.data.gear_stock,
    seeds: allRes.data.seeds_stock,
    eggs: allRes.data.egg_stock,
    honey: allRes.data.honey_stock,
    cosmetics: allRes.data.cosmetics_stock,
    weather: weatherRes.data
  };
}

function buildKey(stock) {
  return JSON.stringify({
    gear: stock.gear.items.map(i => i.name + i.quantity),
    seeds: stock.seeds.items.map(i => i.name + i.quantity),
    eggs: stock.eggs.items.map(i => i.name + i.quantity),
    honey: stock.honey.items.map(i => i.name + i.quantity),
    cosmetics: stock.cosmetics.items.map(i => i.name + i.quantity),
    weatherUpdated: stock.weather.last_updated
  });
}

function buildMessage(stock) {
  return (
    `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗦𝘁𝗼𝗰𝗸 𝗨𝗽𝗱𝗮𝘁𝗲\n\n` +

    `🛠️ 𝗚𝗲𝗮𝗿 (updates every 5 mins):\n` +
    (stock.gear.items.length ? stock.gear.items.map(i => `${i.name} x${i.quantity}`).join("\n") : "No gear.") +
    `\n⏳ Refresh in: ${stock.gear.countdown.formatted}\n\n` +

    `🌱 𝗦𝗲𝗲𝗱𝘀 (updates every 5 mins):\n` +
    (stock.seeds.items.length ? stock.seeds.items.map(i => `${i.name} x${i.quantity}`).join("\n") : "No seeds.") +
    `\n⏳ Refresh in: ${stock.seeds.countdown.formatted}\n\n` +

    `🥚 𝗘𝗴𝗴𝘀 (updates every 30 mins):\n` +
    (stock.eggs.items.length ? stock.eggs.items.map(i => `${i.name} x${i.quantity}`).join("\n") : "No eggs.") +
    `\n⏳ Refresh in: ${stock.eggs.countdown.formatted}\n\n` +

    `🍯 𝗛𝗼𝗻𝗲𝘆 (updates every hour):\n` +
    (stock.honey.items.length ? stock.honey.items.map(i => `${i.name} x${i.quantity}`).join("\n") : "No honey.") +
    `\n⏳ Refresh in: ${stock.honey.countdown.formatted}\n\n` +

    `💄 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀 (updates every 4 hours):\n` +
    (stock.cosmetics.items.length ? stock.cosmetics.items.map(i => `${i.name} x${i.quantity}`).join("\n") : "No cosmetics.") +
    `\n⏳ Refresh in: ${stock.cosmetics.countdown.formatted}\n\n` +

    `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿 (updates every 2 mins): ${stock.weather.icon || "🌦️"} ${stock.weather.currentWeather || "Unknown"}\n` +
    `🪴 𝗕𝗼𝗻𝘂𝘀: ${stock.weather.cropBonuses || "N/A"}\n` +
    `📅 𝗟𝗮𝘀𝘁 𝗨𝗽𝗱𝗮𝘁𝗲: ${getPHTime(stock.weather.last_updated)}\n`
  );
}

// New helper to call refresh API
async function refreshBackend() {
  const res = await axios.get("https://growagardenstock.vercel.app/api/refresh");
  return res.data;
}

async function onCall({ message, args }) {
  const action = args[0]?.toLowerCase();
  const senderId = message.senderID;

  if (action === "off") {
    const session = activeSessions.get(senderId);
    if (session) {
      clearInterval(session.interval);
      activeSessions.delete(senderId);
      return message.reply("🛑 Gagstock tracking stopped.");
    } else {
      return message.reply("⚠️ You don't have an active Gagstock session.");
    }
  }

  if (action === "refresh") {
    await message.reply("🔄 Refreshing stock data from backend, please wait...");

    try {
      await refreshBackend();

      // Wait a few seconds to allow backend update
      await new Promise(resolve => setTimeout(resolve, 4000));

      const stock = await fetchStock();
      const msg = buildMessage(stock);
      return message.reply("✅ Manual refresh complete:\n\n" + msg);
    } catch (err) {
      console.error("❌ Manual refresh error:", err.message);
      return message.reply("❌ Failed to refresh stock data.");
    }
  }

  if (action !== "on") {
    return message.reply("📌 Usage:\n• `gs on` to start tracking\n• `gs off` to stop tracking\n• `gs refresh` to manually refresh stock data");
  }

  if (activeSessions.has(senderId)) {
    return message.reply("📡 You're already tracking Gagstock. Use `gs off` to stop.");
  }

  message.reply("✅ Gagstock tracking started! You'll be notified only when data updates (checked every 5 mins).");

  let lastKey = null;

  const interval = setInterval(async () => {
    try {
      const stock = await fetchStock();
      const newKey = buildKey(stock);

      if (newKey !== lastKey) {
        lastKey = newKey;
        const msg = buildMessage(stock);
        await message.reply(msg);
      }
    } catch (err) {
      console.error("❌ Fetch error:", err.message);
    }
  }, 5 * 60 * 1000); // 5 minutes

  activeSessions.set(senderId, { interval });

  // Initial fetch and message send
  try {
    const stock = await fetchStock();
    lastKey = buildKey(stock);
    const msg = buildMessage(stock);
    await message.reply(msg);
  } catch (err) {
    console.error("❌ Initial fetch failed:", err.message);
  }
}

export default { config, onCall };
