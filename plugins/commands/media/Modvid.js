import { join } from "path";
import axios from "axios";
import fs from "fs";

const config = {
    name: "video",
    aliases: ['rb', 'yt2mp4', 'ytbot'],
    version: "1.0.8",
    description: "Play video from YouTube + auto shorts sender",
    usage: '<keyword/url>\nytbot on|off',
    cooldown: 5,
    credits: "Me + ChatGPT"
};

const langData = {
    "en_US": {
        "video.missingArguement": "Please provide keyword or url",
        "video.noResult": "No results found",
        "video.invalidUrl": "Invalid YouTube URL",
        "video.invaldIndex": "Invalid selection",
        "video.error": "Error occurred",
        "video.downloading": "Downloading video...",
        "video.choose": "Choose a video (reply with number):",
        "ytbot.started": "Auto shorts sender started (every 30 minutes)",
        "ytbot.stopped": "Auto shorts sender stopped"
    },
    // ... other langs as before
};

let autoShortsTimer = null;
const shortKeywords = ["grow a garden", "roblox comedy", "roblox shorts", "grow a garden tips"];

function parseDuration(duration) {
    // Parses hh:mm:ss or mm:ss format to seconds
    const parts = duration.split(":").map(Number);
    if (parts.length === 3) {
        return parts[0]*3600 + parts[1]*60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0]*60 + parts[1];
    }
    return 0;
}

async function downloadFile(url, path) {
    const writer = fs.createWriteStream(path);
    const response = await axios({url, method: 'GET', responseType: 'stream'});
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function playVideo(message, video, getLang) {
    if (!video?.url) return message.reply(getLang("video.error"));
    
    message.react("⏳");
    const cachePath = join(global.cachePath, `_ytvideo${Date.now()}.mp4`);
    
    try {
        const downloadUrl = `https://yt-video-production.up.railway.app/ytdlv3?url=${encodeURIComponent(video.url)}`;
        const response = await axios.get(downloadUrl);
        
        if (!response?.data?.download_url) throw new Error("No download URL");
        
        await message.reply(getLang("video.downloading"));
        await downloadFile(response.data.download_url, cachePath);
        
        if (!fs.existsSync(cachePath)) throw new Error("Download failed");
        
        await message.reply({
            body: video.title || "no title.",
            attachment: fs.createReadStream(cachePath)
        });
        message.react("✅");
    } catch (err) {
        message.react("❌");
        console.error(err);
        message.reply(getLang("video.error"));
    } finally {
        if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    }
}

async function chooseVideo({ message, eventData, getLang }) {
    const { videos } = eventData;
    const index = parseInt(message.body) - 1;
    if (isNaN(index) || index < 0 || index >= videos.length) return message.reply(getLang("video.invaldIndex"));
    await playVideo(message, videos[index], getLang);
}

async function searchVideos(keyword) {
    try {
        const searchUrl = `https://rapido.zetsu.xyz/api/ytsearch?query=${encodeURIComponent(keyword)}`;
        const response = await axios.get(searchUrl);
        return response.data?.data || [];
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function downloadThumbnail(url) {
    if (!url) return null;
    const path = join(global.cachePath, `_ytthumb${Date.now()}.jpg`);
    try {
        await downloadFile(url, path);
        return fs.createReadStream(path);
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function sendRandomShort(message, getLang) {
    // Search for random shorts keywords, filter shorts ≤ 60 sec, send one randomly
    const keyword = shortKeywords[Math.floor(Math.random() * shortKeywords.length)];
    const videos = await searchVideos(keyword);
    const shorts = videos.filter(v => parseDuration(v.duration) <= 60);
    if (!shorts.length) return;

    const random = shorts[Math.floor(Math.random() * shorts.length)];
    const thumb = await downloadThumbnail(random.imgSrc);

    await message.reply({
        body: `🎬 Auto Shorts Drop!\n${random.title}\n${random.url}`,
        attachment: thumb ? [thumb] : []
    });
    if (thumb && thumb.path) fs.unlinkSync(thumb.path);
}

async function onCall({ message, args, getLang }) {
    try {
        // Handle ytbot on/off toggle for auto shorts
        if (args[0] && ["on", "off"].includes(args[0].toLowerCase())) {
            if (args[0].toLowerCase() === "on") {
                if (autoShortsTimer) {
                    return message.reply(getLang("ytbot.started"));
                }
                autoShortsTimer = setInterval(() => {
                    sendRandomShort(message, getLang).catch(console.error);
                }, 30 * 60 * 1000); // every 30 minutes
                return message.reply(getLang("ytbot.started"));
            } else {
                if (autoShortsTimer) {
                    clearInterval(autoShortsTimer);
                    autoShortsTimer = null;
                }
                return message.reply(getLang("ytbot.stopped"));
            }
        }

        if (!args[0]) return message.reply(getLang("video.missingArguement"));
        
        const input = args.join(" ");
        if (input.match(/^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/)) {
            return await playVideo(message, {url: input, title: "YouTube Video"}, getLang);
        }
        
        const videos = await searchVideos(input);
        if (!videos.length) return message.reply(getLang("video.noResult"));
        
        const thumbnails = await Promise.all(videos.slice(0, 10).map(v => downloadThumbnail(v.imgSrc)));
        const formattedList = videos.slice(0, 6).map((v, i) => `${i+1}. ${v.title} (${v.duration})`).join("\n\n");
        
        const sendData = await message.reply({
            body: `${getLang("video.choose")}\n\n${formattedList}`,
            attachment: thumbnails.filter(Boolean)
        });
        
        thumbnails.forEach(thumb => {
            if (thumb?.path) try { fs.unlinkSync(thumb.path); } catch {}
        });
        
        return sendData.addReplyEvent({
            callback: chooseVideo,
            videos: videos.slice(0, 10).map(v => ({title: v.title, url: v.url}))
        });
    } catch (err) {
        console.error(err);
        message.reply(getLang("video.error"));
    }
}

export default {
    config,
    langData,
    onCall
};
