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
import {arrayChunks, range} from '../../lib/helpers';
import {ProfileCache} from './profileCache';
import {Settings} from '../../lib/settings';
import {ChangesetDetails, FilteredNode, Node} from '../../types';
import constants from '../../constants';
import {BoundsHelper} from '../../lib/boundsHelper';
import Logger from '../../lib/log';

const logger = new Logger('FEED');

const getBoundedChangesetsFromSequenceStream = (
    stream: Readable,
    inBounds: (lat: number, lon: number) => boolean
): Promise<ChangesetDetails[]> => {
    return new Promise<ChangesetDetails[]>((resolve, reject) => {
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
            Promise.all(changesetDetails).then(resolve).catch(reject);
        });

        xml.on('error', (e: unknown) => {
            logger.error(`XML parsing error: ${e}`);
            reject(e);
        });
    });
};

const getBoundedChangesetsFromSingleSequence = async (
    sequenceNumber: number,
    inBounds: (lat: number, lon: number) => boolean
) => {
    logger.info(`Fetching sequence ${sequenceNumber}`);
    const sequenceDataStream = await getSequenceDataStream(sequenceNumber);
    const boundedChangesets = await getBoundedChangesetsFromSequenceStream(
        sequenceDataStream,
        inBounds
    );

    logger.info(`Processed ${sequenceNumber}`);
    return {
        id: sequenceNumber,
        changes: boundedChangesets,
    };
};

const getBoundedChangesetsFromSequences = async (
    start: number,
    end: number,
    inBounds: (lat: number, lon: number) => boolean
) => {
    if (start <= end) {
        return await Promise.all(
            range(start, end - start + 1).map((i) =>
                getBoundedChangesetsFromSingleSequence(i, inBounds)
            )
        );
    }
    return [];
};

const sortById = (a: ChangesetDetails, b: ChangesetDetails) => parseInt(a.id) - parseInt(b.id);

class Feed {
    private settings: Settings;
    private profileImageUrlCache: ProfileCache;
    private bounds: BoundsHelper;

    constructor() {
        this.settings = new Settings(constants.settingsFile);
        this.bounds = new BoundsHelper(constants.bounds.outputFileName);
        this.profileImageUrlCache = new ProfileCache();
    }

    async run(): Promise<void> {
        try {
            await Promise.all([await this.settings.readSettings(), await this.bounds.read()]);
        } catch (e) {
            logger.exception(e);
            return;
        }

        // Initialise last processed to latest
        // future inits will start from the last processed sequence
        if (this.settings.settings.last === null) {
            logger.info('No last sequence, starting from most recent');
            const latestSequenceNumber = await getLatestSequenceNumber();

            logger.info(`Got most recent as ${latestSequenceNumber}`);
            this.settings.settings.last = latestSequenceNumber;
            return this.settings.writeSettings();
        }

        this.runProcessing();
    }

    private runProcessing = async (): Promise<void> => {
        logger.info('Processing triggered');
        await this.processingLoop();
        logger.info('Processing completed');
        setTimeout(this.runProcessing, constants.delayMs);
    };

    private processingLoop = async (): Promise<void> => {
        while (true) {
            const latestSequenceNumber = await getLatestSequenceNumber();

            logger.info(
                `Got latest sequence as ${latestSequenceNumber}, last processed is ${this.settings.settings.last}`
            );
            if (this.settings.settings.last < latestSequenceNumber) {
                const clampedDiff = Math.min(
                    latestSequenceNumber - this.settings.settings.last,
                    constants.requestCount
                );
                const start = this.settings.settings.last + 1;
                const end = this.settings.settings.last + clampedDiff;
                logger.info(`Continuing processing loop, from ${start} to ${end}`);
                await this.doProcess(start, end);
            } else {
                logger.info('Stopping processing loop');
                break;
            }
        }
    };

    private inBounds = (lat: number, lon: number): boolean => {
        return this.bounds.pointInBounds(lat, lon);
    };

    private doProcess = async (start: number, end: number): Promise<void> => {
        try {
            const results = await getBoundedChangesetsFromSequences(start, end, this.inBounds);

            logger.debug(JSON.stringify(results));
            const collatedChanges = results.flatMap((v) => v.changes).sort(sortById);

            const embeds = await Promise.all(
                collatedChanges.map((changeset) =>
                    makeFullEmbedForChange(changeset, this.profileImageUrlCache)
                )
            );
            const chunkedEmbeds = arrayChunks(10, embeds);

            // Run sequentially so changeset order is correct
            for (const chunk of chunkedEmbeds) {
                await discord.sendWebhookMessage(
                    this.settings.settings.webhookUrl,
                    undefined,
                    chunk
                );
            }

            this.settings.settings.last = end;
            await this.settings.writeSettings();
        } catch (e) {
            logger.exception(e);
        }
    };
}

export default Feed;
