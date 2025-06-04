import axios from "axios";
import { sendMessage } from "../handles/sendMessage.js";

const activeSessions = new Map();

const config = {
  name: "gagstock",
  description: "Track Grow A Garden stock + weather every 30s (only notify if updated)",
  usage: "gagstock on | gagstock off",
  category: "Tools ⚒️",
  aliases: [],
  cooldown: 0,
  permissions: [0],
  credits: "You"
};

async function onCall({ message, args, senderID, pageAccessToken }) {
  const action = args[0]?.toLowerCase();

  const getPHTime = (timestamp) =>
    new Date(timestamp).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      weekday: "short",
    });

  if (action === "off") {
    const session = activeSessions.get(senderID);
    if (session) {
      clearInterval(session.interval);
      activeSessions.delete(senderID);
      return await sendMessage(senderID, { text: "🛑 Gagstock tracking stopped." }, pageAccessToken);
    } else {
      return await sendMessage(senderID, { text: "⚠️ You don't have an active gagstock session." }, pageAccessToken);
    }
  }

  if (action !== "on") {
    return await sendMessage(senderID, {
      text: "📌 Usage:\n• `gagstock on` to start tracking\n• `gagstock off` to stop tracking"
    }, pageAccessToken);
  }

  if (activeSessions.has(senderID)) {
    return await sendMessage(senderID, {
      text: "📡 You're already tracking Gagstock. Use `gagstock off` to stop."
    }, pageAccessToken);
  }

  await sendMessage(senderID, {
    text: "✅ Gagstock tracking started! You'll be notified when stock or weather changes."
  }, pageAccessToken);

  const fetchAll = async () => {
    try {
      const [gearSeedRes, eggRes, weatherRes] = await Promise.all([
        axios.get("https://growagardenstock.com/api/stock?type=gear-seeds"),
        axios.get("https://growagardenstock.com/api/stock?type=egg"),
        axios.get("https://growagardenstock.com/api/stock/weather")
      ]);

      const gearSeed = gearSeedRes.data;
      const egg = eggRes.data;
      const weather = weatherRes.data;

      const combinedKey = JSON.stringify({
        gear: gearSeed.gear,
        seeds: gearSeed.seeds,
        egg: egg.egg,
        weather: weather.updatedAt
      });

      const previousKey = activeSessions.get(senderID)?.lastCombinedKey;
      if (combinedKey === previousKey) return;

      activeSessions.get(senderID).lastCombinedKey = combinedKey;

      const now = Date.now();

      const gearTime = getPHTime(gearSeed.updatedAt);
      const gearReset = Math.max(300 - Math.floor((now - gearSeed.updatedAt) / 1000), 0);
      const gearResetText = `${Math.floor(gearReset / 60)}m ${gearReset % 60}s`;

      const eggTime = getPHTime(egg.updatedAt);
      const eggReset = Math.max(600 - Math.floor((now - egg.updatedAt) / 1000), 0);
      const eggResetText = `${Math.floor(eggReset / 60)}m ${eggReset % 60}s`;

      const weatherIcon = weather.icon || "🌦️";
      const weatherDesc = weather.currentWeather || "Unknown";
      const weatherBonus = weather.cropBonuses || "N/A";

      const messageText = `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗡𝗲𝘄 𝗦𝘁𝗼𝗰𝗸 & 𝗪𝗲𝗮𝘁𝗵𝗲𝗿\n\n` +
        `🛠️ 𝗚𝗲𝗮𝗿:\n${gearSeed.gear?.join("\n") || "No gear."}\n\n` +
        `🌱 𝗦𝗲𝗲𝗱𝘀:\n${gearSeed.seeds?.join("\n") || "No seeds."}\n\n` +
        `🥚 𝗘𝗴𝗴𝘀:\n${egg.egg?.join("\n") || "No eggs."}\n\n` +
        `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherIcon} ${weatherDesc}\n🪴 𝗕𝗼𝗻𝘂𝘀: ${weatherBonus}\n\n` +
        `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${gearTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${gearResetText}\n\n` +
        `📅 𝗘𝗴𝗴 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${eggTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${eggResetText}`;

      await sendMessage(senderID, { text: messageText }, pageAccessToken);
    } catch (err) {
      console.error("❌ Gagstock Error:", err.message);
    }
  };

  const interval = setInterval(fetchAll, 30 * 1000);
  activeSessions.set(senderID, { interval, lastCombinedKey: null });

  await fetchAll();
}

export default { config, onCall };
