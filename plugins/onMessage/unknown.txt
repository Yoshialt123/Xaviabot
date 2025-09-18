import axios from "axios";

const langData = {
  "en_US": {
    "unknown": "❌ Unknown command{cmd}"
  }
};

const reactions = [
  "airkiss","angrystare","bite","bleh","blush","brofist","celebrate","cheers","clap",
  "confused","cool","cry","cuddle","dance","drool","evillaugh","facepalm","handhold",
  "happy","headbang","hug","huh","kiss","laugh","lick","love","mad","nervous","no",
  "nom","nosebleed","nuzzle","nyah","pat","peek","pinch","poke","pout","punch","roll",
  "run","sad","scared","shout","shrug","shy","sigh","sip","slap","sleep","slowclap",
  "smack","smile","smug","sneeze","sorry","stare","stop","surprised","sweat","thumbsup",
  "tickle","tired","wave","wink","woah","yawn","yay","yes"
];

async function onCall({ message, getLang }) {
  const body = message.body.trim();
  const prefix = global.config.PREFIX;

  if (!body.startsWith(prefix)) return;

  // strip prefix (#something → something)
  const cmd = body.slice(prefix.length).trim().split(" ")[0];

  // pick random gif
  const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];

  try {
    const { data: gifData } = await axios.get(
      `https://api.otakugifs.xyz/gif?reaction=${randomReaction}`
    );
    const response = await axios.get(gifData.url, { responseType: "stream" });

    await message.reply({
      body: getLang("unknown", { cmd: cmd ? `: ${cmd}` : "" }),
      attachment: response.data
    });
  } catch (err) {
    console.error(err);
    await message.reply(getLang("unknown", { cmd: cmd ? `: ${cmd}` : "" }));
  }
}

export default {
  langData,
  onCall
};
