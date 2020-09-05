const axios = require('axios');

const api = "https://discord.com/api";

/**
 *
 * @param {string} token
 * @param {string} channel
 * @param {string} message
 * @param {any} embed
 */
module.exports.sendMessage = (token, channel, message, embed) => {
    return axios.post(`${api}/channels/${channel}/messages`, {
        content: message,
        embed,
    }, {
        headers: {
            Authorization: `Bot ${token}`,
        },
    }).catch((err) => {
        console.log(err);
    });
};

/**
 *
 * @param {string} webhookUrl
 * @param {string} message
 * @param {any} embed
 */
module.exports.sendWebhookMessage = (webhookUrl, message, embed) => {
    return axios.post(webhookUrl, {
        content: message,
        ...(embed && {embeds: [embed]}),
    });
};

module.exports.randomColor = () => {
    const d = ()=>(Math.floor(Math.random()*256)).toString(16);
    const s = "0x"+d()+d()+d();
    return parseInt(s);
}
