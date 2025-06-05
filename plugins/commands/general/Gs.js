import axios from "axios";

const config = {
  name: "gs",
  description: "Track Grow A Garden stock every 5 minutes and notify only if updated", 
  usage: "gs on | gs off",
  cooldown: 3,
  permissions: [0],
  credits: "Converted by Me with ChatGPT"
};

const activeSessions = new Map();

function getPHTime(timestamp) {
  return new Date(timestamp).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    weekday: "short"
  });
}

async function fetchStock() {
  const [allRes, honeyRes, cosmeticsRes] = await Promise.all([
    axios.get("https://growagardenstock.vercel.app/api/stock/all"),
    axios.get("https://growagardenstock.vercel.app/api/stock/honey"),
    axios.get("https://growagardenstock.vercel.app/api/stock/cosmetics")
  ]);

  return {
    all: allRes.data,
    honey: honeyRes.data,
    cosmetics: cosmeticsRes.data
  };
}

function buildKey(stock) {
  return JSON.stringify({
    gear: stock.all.gear_seed_stock.gear,
    seeds: stock.all.gear_seed_stock.seeds,
    eggs: stock.all.egg_stock.items,
    honey: stock.honey.items,
    cosmetics: stock.cosmetics.items,
    weather: stock.all.weather.updatedAt
  });
}

function buildMessage(stock) {
  const now = Date.now();

  const gearUpdated = new Date(stock.all.gear_seed_stock.updatedAt).getTime();
  const eggUpdated = new Date(stock.all.egg_stock.updatedAt).getTime();

  const gearReset = Math.max(300 - Math.floor((now - gearUpdated) / 1000), 0);
  const eggReset = Math.max(600 - Math.floor((now - eggUpdated) / 1000), 0);

  const gearResetText = `${Math.floor(gearReset / 60)}m ${gearReset % 60}s`;
  const eggResetText = `${Math.floor(eggReset / 60)}m ${eggReset % 60}s`;

  return (
    `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗦𝘁𝗼𝗰𝗸 𝗨𝗽𝗱𝗮𝘁𝗲\n\n` +
    `🛠️ 𝗚𝗲𝗮𝗿:\n${stock.all.gear_seed_stock.gear?.join("\n") || "No gear."}\n\n` +
    `🌱 𝗦𝗲𝗲𝗱𝘀:\n${stock.all.gear_seed_stock.seeds?.join("\n") || "No seeds."}\n\n` +
    `🥚 𝗘𝗴𝗴𝘀:\n${stock.all.egg_stock.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No eggs."}\n\n` +
    `🍯 𝗛𝗼𝗻𝗲𝘆:\n${stock.honey.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No honey."}\n\n` +
    `💄 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀:\n${stock.cosmetics.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No cosmetics."}\n\n` +
    `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${stock.all.weather.icon || "🌦️"} ${stock.all.weather.currentWeather || "Unknown"}\n` +
    `🪴 𝗕𝗼𝗻𝘂𝘀: ${stock.all.weather.cropBonuses || "N/A"}\n\n` +
    `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${getPHTime(gearUpdated)}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${gearResetText}\n\n` +
    `📅 𝗘𝗴𝗴 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${getPHTime(eggUpdated)}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${eggResetText}`
  );
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

  if (action !== "on") {
    return message.reply("📌 Usage:\n• `gs on` to start tracking\n• `gs off` to stop tracking");
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
  // Force initial fetch
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
