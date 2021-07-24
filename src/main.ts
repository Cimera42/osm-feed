import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import generateCountryBounds from './bounds/bounds';
import runFeed from './feed/feed';

const argv = yargs(hideBin(process.argv))
    .scriptName('osm-feed')
    .command(
        'feed',
        'Run discord feed',
        () => {},
        () => {
            runFeed();
        }
    )
    .command(
        'bounds <country>',
        'Generate bounds for a country',
        (builder) => {
            return builder.positional('country', {
                describe: 'Country to generate bounds for',
                type: 'string',
            });
        },
        (argv) => {
            console.log(argv);
            generateCountryBounds(argv.country);
        }
    )
    .demandCommand()
    .help().argv;
