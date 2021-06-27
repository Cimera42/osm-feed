import axios from 'axios';
import log from './log';

const api = 'https://discord.com/api';

export interface Embed {
    title: string;
    description: string;
    url: string;
    color: number;
    timestamp: string;
    author: {
        name: string;
        url: string;
        imageUrl?: {
            icon_url: string;
        };
    };
    footer: {
        text: string;
    };
}

/**
 *
 * @param {string} token
 * @param {string} channel
 * @param {string} message
 * @param {Embed} embed
 */
export const sendMessage = (
    token: string,
    channel: string,
    message: string | undefined,
    embed: Embed
) => {
    return axios
        .post(
            `${api}/channels/${channel}/messages`,
            {
                content: message,
                embed,
            },
            {
                headers: {
                    Authorization: `Bot ${token}`,
                },
            }
        )
        .catch((err) => {
            console.log(err);
        });
};

/**
 *
 * @param {string} webhookUrl
 * @param {string} message
 * @param {Embed} embed
 */
export const sendWebhookMessage = (
    webhookUrl: string,
    message: string | undefined,
    embed: Embed
) => {
    return axios
        .post(webhookUrl, {
            content: message,
            ...(embed && {embeds: [embed]}),
        })
        .catch((error) => {
            if (error && error.response) {
                if (error.response.status === 429) {
                    log(`Discord rate limit, waiting ${error.response.data.retry_after}`);
                    return new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(module.exports.sendWebhookMessage(webhookUrl, message, embed));
                        }, error.response.data.retry_after);
                    });
                }
            } else {
                throw error;
            }
        });
};

export const randomColor = () => {
    const d = () => Math.floor(Math.random() * 256).toString(16);
    const s = '0x' + d() + d() + d();
    return parseInt(s);
};
