import moment from 'moment-timezone';
import handleEvents from './events.js';
import { handleDatabase } from './database.js';
import logger from '../var/modules/logger.js';

export default async function handleListen(listenerID) {
    const { handleCommand, handleReaction, handleMessage, handleReply, handleUnsend, handleEvent } = await handleEvents();
    const eventlog_excluded = ["typ", "presence", "read_receipt"];
    const logger = global.modules.get('logger');

    function handleEventLog(event) {
        const { LOG_LEVEL, timezone } = global.config;

        if (LOG_LEVEL == 0) return;
        if (eventlog_excluded.includes(event.type)) return;
        const { type, threadID, body, senderID } = event;
        if (LOG_LEVEL == 1) {
            let time = moment().tz(timezone).format('YYYY-MM-DD_HH:mm:ss');

            if (type == 'message' || type == 'message_reply') {
                logger.custom(
                    `${threadID} • ${senderID} • ${body ? body : 'Photo, video, sticker, etc.'}`,
                    `${time}`
                );
            }
        } else if (LOG_LEVEL == 2) {
            console.log(event);
        }
    }

    return (err, event) => {
        if (global.listenerID != listenerID) return;
        if (!event) {
            logger.error(getLang("handlers.listen.accountError"));
            process.exit(0);
        }
        if (global.maintain && !global.config.MODERATORS.some(e => e == event.senderID || e == event.userID)) return;
        handleEventLog(event);
        if (global.config.ALLOW_INBOX !== true && event.isGroup === false) return;

        (async () => {
            if (!eventlog_excluded.includes(event.type)) {
                await handleDatabase({ ...event });
            }

            switch (event.type) {
                case "message":
                case "message_reply":
                    // First check if it’s a command
                    const isCommand = await handleCommand({ ...event });
                    // If not a command, then process as normal message/reply
                    if (!isCommand) {
                        if (event.type === "message") {
                            await handleMessage({ ...event });
                        } else if (event.type === "message_reply") {
                            await handleReply({ ...event });
                        }
                    }
                    break;

                case "message_reaction":
                    await handleReaction({ ...event });
                    break;

                case "message_unsend":
                    await handleUnsend({ ...event });
                    break;

                case "event":
                case "change_thread_image":
                    await handleEvent({ ...event });
                    break;

                default:
                    break;
            }
        })();
    };
}
