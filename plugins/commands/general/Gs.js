import axios from "axios";

const config = {
  name: "gs",
  description: "Track Grow A Garden stock every 5 minutes and notify only if updated",
  usage: "gs on | gs off",
  cooldown: 3,
  permissions: [0],
  credits: "Converted By Me With Chatgpt ofc"
};

const activeSessions = new Map();

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
    return message.reply("📌 Usage:\n• `gagstock on` to start tracking\n• `gagstock off` to stop tracking");
  }

  if (activeSessions.has(senderId)) {
    return message.reply("📡 You're already tracking Gagstock. Use `gagstock off` to stop.");
  }

  message.reply("✅ Gagstock tracking started! You'll be notified every 5 minutes when data changes.");

  const getPHTime = (timestamp) =>
    new Date(timestamp).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      weekday: "short"
    });

  const fetchAll = async () => {
    try {
      const [allRes, honeyRes, cosmeticsRes] = await Promise.all([
        axios.get("https://growagardenstock.vercel.app/api/stock/all"),
        axios.get("https://growagardenstock.vercel.app/api/stock/honey"),
        axios.get("https://growagardenstock.vercel.app/api/stock/cosmetics")
      ]);

      const stockData = allRes.data;
      const honey = honeyRes.data;
      const cosmetics = cosmeticsRes.data;

      const combinedKey = JSON.stringify({
        gear: stockData.gear_seed_stock.gear,
        seeds: stockData.gear_seed_stock.seeds,
        eggs: stockData.egg_stock.items,
        honey: honey.items,
        cosmetics: cosmetics.items,
        weather: stockData.weather.updatedAt
      });

      const session = activeSessions.get(senderId);
      if (combinedKey === session?.lastCombinedKey) return;

      session.lastCombinedKey = combinedKey;

      const now = Date.now();

      const gearUpdated = new Date(stockData.gear_seed_stock.updatedAt).getTime();
      const eggUpdated = new Date(stockData.egg_stock.updatedAt).getTime();

      const gearTime = getPHTime(gearUpdated);
      const eggTime = getPHTime(eggUpdated);

      const gearReset = Math.max(300 - Math.floor((now - gearUpdated) / 1000), 0);
      const eggReset = Math.max(600 - Math.floor((now - eggUpdated) / 1000), 0);

      const gearResetText = `${Math.floor(gearReset / 60)}m ${gearReset % 60}s`;
      const eggResetText = `${Math.floor(eggReset / 60)}m ${eggReset % 60}s`;

      const weatherIcon = stockData.weather.icon || "🌦️";
      const weatherDesc = stockData.weather.currentWeather || "Unknown";
      const weatherBonus = stockData.weather.cropBonuses || "N/A";

      const messageText =
        `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗦𝘁𝗼𝗰𝗸 𝗨𝗽𝗱𝗮𝘁𝗲\n\n` +
        `🛠️ 𝗚𝗲𝗮𝗿:\n${stockData.gear_seed_stock.gear?.join("\n") || "No gear."}\n\n` +
        `🌱 𝗦𝗲𝗲𝗱𝘀:\n${stockData.gear_seed_stock.seeds?.join("\n") || "No seeds."}\n\n` +
        `🥚 𝗘𝗴𝗴𝘀:\n${stockData.egg_stock.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No eggs."}\n\n` +
        `🍯 𝗛𝗼𝗻𝗲𝘆:\n${honey.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No honey."}\n\n` +
        `💄 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀:\n${cosmetics.items.map(i => `${i.name} x${i.quantity}`).join("\n") || "No cosmetics."}\n\n` +
        `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherIcon} ${weatherDesc}\n🪴 𝗕𝗼𝗻𝘂𝘀: ${weatherBonus}\n\n` +
        `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${gearTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${gearResetText}\n\n` +
        `📅 𝗘𝗴𝗴 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${eggTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${eggResetText}`;

      await message.reply(messageText);
    } catch (err) {
      console.error("❌ Gagstock Error:", err.message);
    }
  };

  const interval = setInterval(fetchAll, 5 * 60 * 1000); // every 5 minutes
  activeSessions.set(senderId, { interval, lastCombinedKey: null });

  await fetchAll(); // initial fetch
}

export default { config, onCall };
      
