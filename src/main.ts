import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import generateCountryBounds from './commands/bounds/bounds';
import Feed from './commands/feed/feed';
import Logger from './lib/log';

const logger = new Logger('MAIN');

yargs(hideBin(process.argv))
    .scriptName('osm-feed')
    .command(
        'feed',
        'Run discord feed',
        () => {
            return;
        },
        async () => {
            const feed = new Feed();
            await feed.run();
        }
    )
    .command(
        'bounds <country> [--dev]',
        'Generate bounds for a country',
        (builder) => {
            return builder
                .positional('country', {
                    describe: 'Country to generate bounds for',
                    type: 'string',
                })
                .option('dev', {
                    describe: 'Optimise process, and output files for development',
                    type: 'boolean',
                });
        },
        (argv) => {
            logger.debug(JSON.stringify(argv));
            generateCountryBounds(argv.country, argv.dev);
        }
    )
    .demandCommand()
    .help().argv;
