import axios, {AxiosResponse} from 'axios';
import Logger from '../log';

const logger = new Logger('DISCORD-API');
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

export const sendMessage = async (
    token: string,
    channel: string,
    message: string | undefined,
    embed: Embed
): Promise<AxiosResponse<unknown>> => {
    return axios.post(
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
    );
};

export const sendWebhookMessage = async (
    webhookUrl: string,
    message?: string,
    embed?: Embed
): Promise<AxiosResponse<unknown>> => {
    try {
        return await axios.post(webhookUrl, {
            content: message,
            embeds: embed ? [embed] : [],
        });
    } catch (error) {
        if (error?.response?.status === 429) {
            logger.warn(`Discord rate limit, waiting ${error.response.data.retry_after}`);
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(sendWebhookMessage(webhookUrl, message, embed));
                }, error.response.data.retry_after);
            });
        }
        throw new Error(error);
    }
};

export const randomColor = (): number => {
    const d = () => Math.floor(Math.random() * 256).toString(16);
    const s = '0x' + d() + d() + d();
    return parseInt(s);
};
