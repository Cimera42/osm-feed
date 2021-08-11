import yargs, {boolean} from 'yargs';
import {hideBin} from 'yargs/helpers';
import generateCountryBounds from './commands/bounds/bounds';
import runFeed from './commands/feed/feed';

yargs(hideBin(process.argv))
    .scriptName('osm-feed')
    .command(
        'feed',
        'Run discord feed',
        () => {
            return;
        },
        () => {
            runFeed();
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
            console.log(argv);
            generateCountryBounds(argv.country, argv.dev);
        }
    )
    .demandCommand()
    .help().argv;
