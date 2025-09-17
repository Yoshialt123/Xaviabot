// commands/mc-afk.js
import { createClient } from "bedrock-protocol";
import { Vec3 } from "vec3";

const config = {
  name: "mcafk",
  aliases: ["minecraft-afk", "afkbot"],
  description: "Connects to a Minecraft server as an AFK bot",
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

  const client = createClient({
    host: "Zerenityhunters.enderman.cloud", // 🔧 change to your server
    port: 36703,
    username: "Herobrine", // 🔧 change if needed
    offline: true
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

  // Store bot
  activeBots.set(senderId, client);
}

export default {
  config,
  onCall
};
