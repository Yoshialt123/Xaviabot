// commands/mcafk.js
const bedrock = require("bedrock-protocol");
const { Vec3 } = require("vec3");

const config = {
  name: "mcafk",
  aliases: ["minecraft-afk", "afkbot"],
  description: "Connects to a Minecraft Bedrock server as an AFK bot",
  usage: "mcafk on | mcafk off",
  category: "Tools ⚒️",
  cooldown: 3,
  permissions: [0],
  credits: "Made by Yoshialt123"
};

const activeBots = new Map();

async function onCall({ message, args }) {
  const senderId = message.senderID || message.threadID;
  const action = args[0]?.toLowerCase();

  if (action === "off") {
    const bot = activeBots.get(senderId);
    if (bot) {
      bot.disconnect("Stopped by user");
      activeBots.delete(senderId);
      return message.send("🛑 AFK bot disconnected.");
    } else {
      return message.send("⚠️ No active AFK bot session.");
    }
  }

  if (action !== "on") {
    return message.send(
      "📌 Usage:\n• `mcafk on` to start AFK bot\n• `mcafk off` to stop AFK bot"
    );
  }

  if (activeBots.has(senderId)) {
    return message.send("📡 Bot already running. Use `mcafk off` first.");
  }

  // ✅ Correct import & client creation
  const client = bedrock.createClient({
    host: "Skirk.enderman.cloud", // your server
    port: 33316, // your server port
    username: "Afk_Bot", // change if needed
    offline: true // set false if server needs Xbox login
  });

  client.on("connect", () => {
    message.send("✅ AFK bot connected to server!");
  });

  client.on("disconnect", () => {
    message.send("🔌 AFK bot disconnected.");
    activeBots.delete(senderId);
  });

  client.on("error", (err) => {
    console.error("Bot error:", err);
    message.send("⚠️ Bot error occurred. Check logs.");
    activeBots.delete(senderId);
  });

  // Store the bot session
  activeBots.set(senderId, client);
}

module.exports = {
  config,
  onCall
};
