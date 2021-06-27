import rax from 'retry-axios';
import axios from 'axios';
import zlib from 'zlib';
import {parseStringPromise as parseXML} from 'xml2js';
import schedule from 'node-schedule';
import {promises as fs} from 'fs';

import log from './log';
import * as discord from './discord';
import {
    FilteredNode,
    ChangesetDetails,
    ChangesetDetailsResponse,
    SequenceXML,
    Settings,
    NodeSet,
    UserResponse,
} from './types';

const minuteURL = 'https://planet.openstreetmap.org/replication/minute/';
const settingsFile = './settings.json';
const requestCount = 5;

// Global variables
let settings: Settings;
const profileImageUrlCache: Record<string, Promise<string | null>> = {};
let isProcessing = false;

const axiosInstance = axios.create({
    timeout: 30000,
});
axiosInstance.defaults.raxConfig = {
    instance: axiosInstance,
    retry: 3,
    noResponseRetries: 3,
};
const interceptorId = rax.attach(axiosInstance);

const gunzip = (data: ArrayBuffer) => {
    return new Promise<Buffer>((resolve, reject) => {
        zlib.gunzip(data, (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result);
        });
    });
};

const pad3 = (n: number) => String(n).padStart(3, '0');
const range = (start: number, size: number) => Array.from(Array(size), (_, i) => i + start);

const getURLForSequenceNumber = (id: number) => {
    const f1 = pad3(Math.floor(id / 1000000));
    const f2 = pad3(Math.floor((id / 1000) % 1000));
    const f3 = pad3(Math.floor(id % 1000));
    return `${minuteURL}${f1}/${f2}/${f3}.osc.gz`;
};

// TODO: handle crossing of east/west equator, north/south pole
// TODO check min-max bounds of changeset
const inBounds = (lat: number, lon: number) =>
    lat < settings.bounds.top &&
    lat > settings.bounds.bottom &&
    lon < settings.bounds.right &&
    lon > settings.bounds.left;

const filterNodesToChangeset = (
    filtered: Map<string, FilteredNode>,
    nodes: NodeSet
): Map<string, FilteredNode> => {
    if (nodes.node) {
        for (let i = 0; i < nodes.node.length; i++) {
            const nodeData = nodes.node[i].$;
            if (!filtered.has(nodeData.changeset)) {
                if (inBounds(parseFloat(nodeData.lat), parseFloat(nodeData.lon))) {
                    const newMap = new Map(filtered);
                    newMap.set(nodeData.changeset, {
                        changeset: nodeData.changeset,
                        timestamp: nodeData.timestamp,
                    });
                    return newMap;
                }
            }
        }
    }
    return filtered;
};

const getChangesetDetails = async (info: FilteredNode): Promise<ChangesetDetails> => {
    const {changeset, timestamp} = info;

    const response = await axiosInstance.get<ChangesetDetailsResponse>(
        `https://www.openstreetmap.org/api/0.6/changeset/${changeset}.json`
    );

    const element = response.data.elements[0];
    return {
        id: changeset,
        uid: element.uid,
        username: element.user,
        count: element.changes_count,
        comment: element.tags?.comment || '(no comment)',
        time: timestamp,
    };
};

const getSequenceData = async (sequenceNumber: number): Promise<SequenceXML> => {
    const url = getURLForSequenceNumber(sequenceNumber);
    return axiosInstance.get<ArrayBuffer>(url, {responseType: 'arraybuffer'}).then((res) => {
        return gunzip(res.data).then((result) => {
            return parseXML(result.toString('utf8'));
        });
    });
};

const getBoundedChangesetsFromSequenceXML = (xml: SequenceXML) => {
    let filteredChangesets = new Map<string, FilteredNode>();
    if (xml.osmChange.create) {
        filteredChangesets = xml.osmChange.create.reduce(
            filterNodesToChangeset,
            filteredChangesets
        );
    }
    if (xml.osmChange.modify) {
        filteredChangesets = xml.osmChange.modify.reduce(
            filterNodesToChangeset,
            filteredChangesets
        );
    }
    if (xml.osmChange.delete) {
        filteredChangesets = xml.osmChange.delete.reduce(
            filterNodesToChangeset,
            filteredChangesets
        );
    }
    const changesetDetails = Array.from(filteredChangesets.values()).map(getChangesetDetails);
    return Promise.all(changesetDetails);
};

const getLatestSequenceNumber = async () => {
    const response = await axiosInstance.get<string>(`${minuteURL}state.txt`);
    const match = response.data.match(/sequenceNumber=(\d+)/);
    if (!match) {
        throw new Error('Could not get latest sequence number.');
    }
    return parseInt(match[1]);
};

const process = async (sequenceNumber: number) => {
    log(`Fetching sequence ${sequenceNumber}`);
    const sequenceData = await getSequenceData(sequenceNumber);
    const boundedChangesets = await getBoundedChangesetsFromSequenceXML(sequenceData);

    log(`Processed ${sequenceNumber}`);
    return {
        id: sequenceNumber,
        changes: boundedChangesets,
    };
};

const processFromTo = (start: number, end: number) => {
    if (start <= end) {
        return Promise.all(range(start, end - start + 1).map(process));
    }
    return Promise.resolve([]);
};

const readSettings = async () => {
    const settingsValue = await fs.readFile(settingsFile, 'utf-8');
    settings = JSON.parse(settingsValue);
    log('Read settings as:');
    log(settings);
};
const writeSettings = () => {
    log('Wrote settings as:');
    log(settings);
    return fs.writeFile(settingsFile, JSON.stringify(settings, null, 4), 'utf-8');
};

const sortById = (a: ChangesetDetails, b: ChangesetDetails) => parseInt(a.id) - parseInt(b.id);
const makeEmbedFromChange = (
    change: ChangesetDetails,
    imageUrl: string | null = null
): discord.Embed => ({
    title: change.id,
    description: change.comment,
    url: `https://www.openstreetmap.org/changeset/${change.id}`,
    color: discord.randomColor(),
    timestamp: change.time,
    author: {
        name: change.username,
        url: encodeURI(`https://www.openstreetmap.org/user/${change.username}`),
        ...(imageUrl ? {icon_url: imageUrl} : {}),
    },
    footer: {
        text: `${change.count} changes`,
    },
});

const getProfileImageUrl = (userId: number) => {
    const cached = profileImageUrlCache[userId];
    if (cached) {
        log(`Using cached profile image for ${userId}`);
        return cached;
    } else {
        const get = axios
            .get<UserResponse>(`https://api.openstreetmap.org/api/0.6/user/${userId}.json`)
            .then((response) => {
                const url = response.data.user.img?.href || null;
                log(`Cached profile image for ${userId} as ${url}`);
                return url;
            });
        profileImageUrlCache[userId] = get;
        return get;
    }
};

const makeFullEmbedForChange = async (change: ChangesetDetails) => {
    const imageUrl = await getProfileImageUrl(change.uid);
    return makeEmbedFromChange(change, imageUrl);
};

const doProcess = async (start: number, end: number) => {
    const results = await processFromTo(start, end);

    log(results);
    const collatedChanges = results
        .reduce<ChangesetDetails[]>((arr, minute) => [...arr, ...minute.changes], [])
        .sort(sortById);

    const embedPromises = collatedChanges.map(makeFullEmbedForChange);
    const embeds = await Promise.all(embedPromises);

    const messagePromises = embeds.map((embed) =>
        discord.sendWebhookMessage(settings.webhookUrl, undefined, embed)
    );

    await Promise.all(messagePromises);

    settings.last = end;
    return writeSettings();
};

const processingLoop = async () => {
    while (true) {
        const latestSequenceNumber = await getLatestSequenceNumber();

        log(`Got latest sequence as ${latestSequenceNumber}, last processed is ${settings.last}`);
        if (settings.last < latestSequenceNumber) {
            // Only do 10 at a time to prevent request timeouts
            const clampedDiff = Math.min(latestSequenceNumber - settings.last, requestCount);
            const start = settings.last + 1;
            const end = settings.last + clampedDiff;
            log(`Continuing processing loop, from ${start} to ${end}`);
            await doProcess(start, end);
        } else {
            log('Stopping processing loop');
            break;
        }
    }
};

const processingLock = () => {
    log('Processing triggered');
    if (!isProcessing) {
        log('Processing not in-progress, commencing');
        isProcessing = true;
        processingLoop().finally(() => {
            log('Processing completed');
            isProcessing = false;
        });
    } else {
        log('Processing in-progress, skipping');
    }
};

const main = async () => {
    await readSettings();

    // Initialise last processed to latest
    // future inits will start from the last processed sequence
    if (settings.last === null) {
        log('No last sequence, starting from most recent');
        const latestSequenceNumber = await getLatestSequenceNumber();

        log(`Got most recent as ${latestSequenceNumber}`);
        settings.last = latestSequenceNumber;
        return writeSettings();
    }

    processingLock();
    const job = schedule.scheduleJob(
        {
            second: 10,
            minute: new schedule.Range(0, 59, 1),
        },
        processingLock
    );
};

main();
