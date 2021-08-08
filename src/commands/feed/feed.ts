import axios from 'axios';
import schedule from 'node-schedule';
import rax from 'retry-axios';
import {Readable} from 'stream';
import XmlStream from 'xml-stream';
import zlib from 'zlib';
import * as discord from '../../lib/apis/discord';
import {
    getChangesetDetails,
    getLatestSequenceNumber,
    getSequenceDataStream,
} from '../../lib/apis/osm';
import {makeFullEmbedForChange} from './embed';
import {range} from '../../helpers';
import log from '../../log';
import {ProfileCache} from './profileCache';
import {Settings} from '../../settings';
import {ChangesetDetails, FilteredNode, Node} from '../../types';

const settingsFile = './settings.json';
const requestCount = 5;

// Global variables
let settings: Settings;
let profileImageUrlCache: ProfileCache;
let isProcessing = false;

const axiosInstance = axios.create({
    timeout: 30000,
});
axiosInstance.defaults.raxConfig = {
    instance: axiosInstance,
    retry: 3,
    noResponseRetries: 3,
};
rax.attach(axiosInstance);

// TODO: handle crossing of east/west equator, north/south pole
const inBounds = (lat: number, lon: number) =>
    lat < settings.settings.bounds.top &&
    lat > settings.settings.bounds.bottom &&
    lon < settings.settings.bounds.right &&
    lon > settings.settings.bounds.left;

const getBoundedChangesetsFromSequenceStream = (stream: Readable) => {
    return new Promise<ChangesetDetails[]>((resolve) => {
        const filteredChangesets = new Map<string, FilteredNode>();

        const unzipped = stream.pipe(zlib.createGunzip());
        const xml = new XmlStream(unzipped);

        xml.on('startElement: node', (node: Node) => {
            const nodeData = node.$;
            if (!filteredChangesets.has(nodeData.changeset)) {
                if (inBounds(parseFloat(nodeData.lat), parseFloat(nodeData.lon))) {
                    filteredChangesets.set(nodeData.changeset, {
                        changeset: nodeData.changeset,
                        timestamp: nodeData.timestamp,
                    });
                }
            }
        });

        xml.on('end', () => {
            const changesetDetails = Array.from(filteredChangesets.values()).map(
                getChangesetDetails
            );
            resolve(Promise.all(changesetDetails));
        });
    });
};

const processSingleSequence = async (sequenceNumber: number) => {
    log(`Fetching sequence ${sequenceNumber}`);
    const sequenceDataStream = await getSequenceDataStream(sequenceNumber);
    const boundedChangesets = await getBoundedChangesetsFromSequenceStream(sequenceDataStream);

    log(`Processed ${sequenceNumber}`);
    return {
        id: sequenceNumber,
        changes: boundedChangesets,
    };
};

const processFromTo = (start: number, end: number) => {
    if (start <= end) {
        return Promise.all(range(start, end - start + 1).map(processSingleSequence));
    }
    return Promise.resolve([]);
};

const sortById = (a: ChangesetDetails, b: ChangesetDetails) => parseInt(a.id) - parseInt(b.id);

const doProcess = async (start: number, end: number) => {
    const results = await processFromTo(start, end);

    log(results);
    const collatedChanges = results.flatMap((v) => v.changes).sort(sortById);

    const embedPromises = collatedChanges.map((changeset) =>
        makeFullEmbedForChange(changeset, profileImageUrlCache)
    );
    const embeds = await Promise.all(embedPromises);

    const messagePromises = embeds.map((embed) =>
        discord.sendWebhookMessage(settings.settings.webhookUrl, undefined, embed)
    );

    await Promise.all(messagePromises);

    settings.settings.last = end;
    return settings.writeSettings();
};

const processingLoop = async () => {
    while (true) {
        const latestSequenceNumber = await getLatestSequenceNumber();

        log(
            `Got latest sequence as ${latestSequenceNumber}, last processed is ${settings.settings.last}`
        );
        if (settings.settings.last < latestSequenceNumber) {
            const clampedDiff = Math.min(
                latestSequenceNumber - settings.settings.last,
                requestCount
            );
            const start = settings.settings.last + 1;
            const end = settings.settings.last + clampedDiff;
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

const runFeed = async (): Promise<void> => {
    settings = new Settings(settingsFile);
    await settings.readSettings();

    profileImageUrlCache = new ProfileCache();

    // Initialise last processed to latest
    // future inits will start from the last processed sequence
    if (settings.settings.last === null) {
        log('No last sequence, starting from most recent');
        const latestSequenceNumber = await getLatestSequenceNumber();

        log(`Got most recent as ${latestSequenceNumber}`);
        settings.settings.last = latestSequenceNumber;
        return settings.writeSettings();
    }

    processingLock();
    schedule.scheduleJob(
        {
            second: 10,
            minute: new schedule.Range(0, 59, 1),
        },
        processingLock
    );
};

export default runFeed;
