import axios from "axios";

const config = {
  name: "gs",
  description: "Funny GagStock Tracker with Smart Timer",
  usage: "gs on | gs off | gs now",
  cooldown: 3,
  permissions: [0],
  credits: "You + ChatGPT 💚"
};

const activeSessions = new Map();

function getPHTime(iso) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    weekday: "short"
  });
}

async function fetchStock() {
  const [stockRes, weatherRes] = await Promise.all([
    axios.get("https://growagardenstock.vercel.app/api/stock/all"),
    axios.get("https://growagardenstock.vercel.app/api/weather")
  ]);

  return {
    gear: stockRes.data.gear_stock,
    seeds: stockRes.data.seeds_stock,
    eggs: stockRes.data.egg_stock,
    honey: stockRes.data.honey_stock,
    cosmetics: stockRes.data.cosmetics_stock,
    weather: weatherRes.data
  };
}

function buildKey(s) {
  return JSON.stringify({
    gear: s.gear.items.map(i => i.name + i.quantity),
    seeds: s.seeds.items.map(i => i.name + i.quantity),
    eggs: s.eggs.items.map(i => i.name + i.quantity),
    honey: s.honey.items.map(i => i.name + i.quantity),
    cosmetics: s.cosmetics.items.map(i => i.name + i.quantity),
    weather: s.weather.last_updated
  });
}

function funStockMsg(s) {
  const formatItems = list => list.length ? list.map(i => `• ${i.name} x${i.quantity}`).join("\n") : "Nada. 💤";

  return `🌻 𝗚𝗮𝗴𝗦𝘁𝗼𝗰𝗸 𝗥𝗲𝗽𝗼𝗿𝘁 — ${getPHTime(s.weather.last_updated)} 🌤️\n\n` +
    `🛠️ 𝗚𝗲𝗮𝗿\n${formatItems(s.gear.items)}\n⏳ Next: ${s.gear.countdown.formatted}\n\n` +
    `🌱 𝗦𝗲𝗲𝗱𝘀\n${formatItems(s.seeds.items)}\n⏳ Next: ${s.seeds.countdown.formatted}\n\n` +
    `🥚 𝗘𝗴𝗴𝘀\n${formatItems(s.eggs.items)}\n⏳ Next: ${s.eggs.countdown.formatted}\n\n` +
    `🍯 𝗛𝗼𝗻𝗲𝘆\n${formatItems(s.honey.items)}\n⏳ Next: ${s.honey.countdown.formatted}\n\n` +
    `💄 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀\n${formatItems(s.cosmetics.items)}\n⏳ Next: ${s.cosmetics.countdown.formatted}\n\n` +
    `🌦️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${s.weather.icon} ${s.weather.currentWeather}\n🪴 Bonus Crop: ${s.weather.cropBonuses || "None"}\n` +
    `📅 Updated: ${getPHTime(s.weather.last_updated)}\n` +
    `🔁 Type "gs now" for an instant drop, or "gs off" to stop this farm party.`;
}

export async function onCall({ message, args }) {
  const cmd = args[0]?.toLowerCase();
  const sender = message.senderID;

  if (cmd === "off") {
    const session = activeSessions.get(sender);
    if (session) {
      clearTimeout(session.timeout);
      activeSessions.delete(sender);
      return message.reply("🛑 Chill out farmer! GagStock auto-tracking has stopped.");
    } else {
      return message.reply("⚠️ No active GagStock session to stop, boss!");
    }
  }

  if (cmd === "now") {
    try {
      const stock = await fetchStock();
      return message.reply(funStockMsg(stock));
    } catch {
      return message.reply("⚠️ Error getting live stock, baka down si scarecrow 😔");
    }
  }

  if (cmd !== "on") {
    return message.reply("📌 Usage:\n• `gs on` to start funny tracking\n• `gs now` to check now\n• `gs off` to stop tracking");
  }

  if (activeSessions.has(sender)) {
    return message.reply("📡 Already tracking boss! Wait for alerts or type `gs now`.");
  }

  message.reply("✅ GagStock activated! 🌽 You'll be pinged every time there’s new loot.");

  let lastKey = null;

  async function smartLoop() {
    try {
      const stock = await fetchStock();
      const newKey = buildKey(stock);

      if (newKey !== lastKey) {
        lastKey = newKey;
        await message.reply(funStockMsg(stock));
      }

      const next = Math.max(
        Math.min(
          stock.gear.countdown.seconds,
          stock.seeds.countdown.seconds,
          stock.eggs.countdown.seconds,
          stock.honey.countdown.seconds,
          stock.cosmetics.countdown.seconds
        ),
        10
      );

      const timeout = setTimeout(smartLoop, next * 1000);
      activeSessions.set(sender, { timeout });

    } catch (err) {
      console.error("Loop error:", err.message);
      const fallback = setTimeout(smartLoop, 60 * 1000);
      activeSessions.set(sender, { timeout: fallback });
    }
  }

  // Start loop
  try {
    const stock = await fetchStock();
    lastKey = buildKey(stock);
    await message.reply(funStockMsg(stock));
    smartLoop();
  } catch (err) {
    console.error("Start error:", err.message);
    return message.reply("❌ Couldn’t fetch stock. Server baka down?");
  }
}

export default { config, onCall };
    
