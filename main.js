const rax = require('retry-axios');
const axios = require('axios');
const zlib = require('zlib');
const parseXML = require('xml2js').parseStringPromise;
const schedule = require('node-schedule');
const fs = require('fs').promises;
const log = require('./log');
const discord = require('./discord');

const axiosInstance = axios.create({
    timeout: 15000,
});
axiosInstance.defaults.raxConfig = {
    instance: axiosInstance,
    retry: 3,
    retryDelay: 1000,
};
const interceptorId = rax.attach(axiosInstance);

const gunzip = (data) => new Promise((resolve, reject) => {
    zlib.gunzip(data, (err, result) => {
        if(err) {
            return reject(err);
        }
        resolve(result);
    });
});

const minuteURL = 'https://planet.openstreetmap.org/replication/minute/'

// Australia bounds
const bounds = {
    top: -9.088013,
    bottom: -44.5904672,
    left: 112.5878906,
    right: 154.5117188,
};

const pad3 = (n) => String(n).padStart(3, '0');
const range = (start, size) => [...Array(size).keys()].map(i => i + start);

const getURLForSequenceNumber = (id) => {
    const f1 = pad3(Math.floor(id / 1000000));
    const f2 = pad3(Math.floor((id / 1000) % 1000));
    const f3 = pad3(Math.floor(id % 1000));
    return `${minuteURL}${f1}/${f2}/${f3}.osc.gz`;
};

// TODO: handle crossing of east/west equator, north/south pole
const inBounds = (lat, lon) => (
    lat < bounds.top &&
    lat > bounds.bottom &&
    lon < bounds.right &&
    lon > bounds.left
);

const filterNodesToChangeset = (filtered, nodes) => {
    if(nodes.node) {
        for(let i = 0; i < nodes.node.length; i++) {
            const nodeData = nodes.node[i].$;
            if(inBounds(nodeData.lat, nodeData.lon)) {
                return new Set([...filtered, nodeData.changeset]);
            }
        }
    }
    return filtered;
};

const getChangesetDetails = (id) => {
    return axiosInstance.get(`https://www.openstreetmap.org/api/0.6/changeset/${id}`).then(response => {
        const element = response.data.elements[0];
        return {
            id,
            uid: element.uid,
            username: element.user,
            count: element.changes_count,
            comment: element.tags.comment === undefined ? null : element.tags.comment,
            time: element.created_at,
        };
    });
};

const getSequenceData = (sequenceNumber) => {
    const url = getURLForSequenceNumber(sequenceNumber);
    return axiosInstance.get(url, { responseType: 'arraybuffer' }).then(res => {
        return gunzip(res.data).then((result) => {
            return parseXML(result.toString('utf8'));
        });
    });
};

const getBoundedChangesetsFromSequenceXML = (xml) => {
    let filteredChangesets = new Set();
    if(xml.osmChange.create) {
        filteredChangesets = xml.osmChange.create.reduce(filterNodesToChangeset, filteredChangesets);
    }
    if(xml.osmChange.modify) {
        filteredChangesets = xml.osmChange.modify.reduce(filterNodesToChangeset, filteredChangesets);
    }
    if(xml.osmChange.delete) {
        filteredChangesets = xml.osmChange.delete.reduce(filterNodesToChangeset, filteredChangesets);
    }
    const changesetDetails = [...filteredChangesets].map(getChangesetDetails);
    return Promise.all(changesetDetails);
};

const getLatestSequenceNumber = () => {
    return axiosInstance.get(`${minuteURL}state.txt`).then((response) => {
        return parseInt(response.data.match(/sequenceNumber=(\d+)/)[1]);
    });
};

const process = (sequenceNumber) => {
    log(`Fetching sequence ${sequenceNumber}`);
    return getSequenceData(sequenceNumber)
        .then(getBoundedChangesetsFromSequenceXML)
        .then(results => {
            log(`Processed ${sequenceNumber}`);
            return {
                id: sequenceNumber,
                changes: results,
            };
        });
};

const processFromTo = (start, end) => {
    if(start <= end) {
        return Promise.all(range(start, (end - start) + 1).map(process));
    }
    return Promise.resolve([]);
};

const settingsFile = './settings.json';

// Global settings var
let settings;
const readSettings = () => {
    return fs.readFile(settingsFile)
        .then(JSON.parse)
        .then((result) => {
            settings = result;
            log('Read settings as:');
            log(settings);
        });
};
const writeSettings = () => {
    log('Wrote settings as:');
    log(settings);
    return fs.writeFile(settingsFile, JSON.stringify(settings, null, 4));
};

const sortById = (a, b) => a.id - b.id;
const makeEmbedFromChange = (change, imageUrl = null) => ({
    title: change.id,
    description: change.comment,
    url: `https://www.openstreetmap.org/changeset/${change.id}`,
    color: discord.randomColor(),
    timestamp: change.time,
    author: {
        name: change.username,
        url: `https://www.openstreetmap.org/user/${change.username}`,
        ...(imageUrl && {icon_url: imageUrl}),
    },
    footer: {
        text: `${change.count} changes`
    }
});

const profileImageUrlCache = {};

const getProfileImageUrl = (userId) => {
    const cached = profileImageUrlCache[userId];
    if(cached) {
        return cached;
    } else {
        const get = axios.get(`https://api.openstreetmap.org/api/0.6/user/${userId}`).then(response => {
            return parseXML(response.data).then(xml => xml.osm.user[0].img ? xml.osm.user[0].img[0].$.href : null);
        });
        profileImageUrlCache[userId] = get;
        return get;
    }
};

const sendMessageForChange = (change) => {
    return getProfileImageUrl(change.uid)
        .then((imageUrl) => {
            const embed = makeEmbedFromChange(change, imageUrl);
            return discord.sendWebhookMessage(settings.webhookUrl, undefined, embed);
        });
};

const doProcess = (start, end) => {
    return processFromTo(start, end)
        .then((results) => {
            log(results);
            const collatedChanges = results.reduce((arr, minute) => [...arr, ...minute.changes], []).sort(sortById);
            const messagePromises = collatedChanges.map(sendMessageForChange);

            return Promise.all(messagePromises).then(() => {
                settings.last = end;
                return writeSettings();
            });
        });
};

const promiseLoop = (getNext) => {
    return getNext().then((doContinue) => {
        if(doContinue) {
            return promiseLoop(getNext);
        }
    });
}

const processingLoop = () => {
    return promiseLoop(() => {
        return getLatestSequenceNumber().then(latestSequenceNumber => {
            log(`Got latest sequence as ${latestSequenceNumber}, last processed is ${settings.last}`)
            if(settings.last < latestSequenceNumber) {
                // Only do 10 at a time to prevent request timeouts
                const clampedDiff = Math.min(latestSequenceNumber - settings.last, 10);
                const start = settings.last + 1;
                const end = settings.last + clampedDiff;
                log(`Continuing processing loop, from ${start} to ${end}`);
                return doProcess(start, end).then(() => true);
            } else {
                log('Stopping processing loop');
                return Promise.resolve(false);
            }
        });
    });
};

let isProcessing = false;
const processingLock = () => {
    log('Processing triggered');
    if(!isProcessing) {
        log('Processing not in-progress, commencing');
        isProcessing = true;
        processingLoop().finally(() => {
            log('Processing completed');
            isProcessing = false;
        });
    } else {
        log('Processing in-progress, skipping');
    }
}

readSettings().then(() => {
    let setup = Promise.resolve();
    // Initialise last processed to latest
    // future inits will start from the last processed sequence
    if(settings.last === null) {
        log('No last sequence, starting from most recent');
        setup = getLatestSequenceNumber().then(latestSequenceNumber => {
            log(`Got most recent as ${latestSequenceNumber}`);
            settings.last = latestSequenceNumber
            return writeSettings();
        });
    }

    return setup.then(() => {
        processingLock();
        const job = schedule.scheduleJob({
            second: 10,
            minute: new schedule.Range(0, 59, 1)
        }, processingLock);
    });
});
