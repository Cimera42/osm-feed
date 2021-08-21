const dataDir = 'data';
const rawFileName = `${dataDir}/raw.json`;
const fullLoopsFileName = `${dataDir}/loops.json`;
const outputFileName = `${dataDir}/countryBounds.json`;

export default {
    settingsFile: './settings.json',
    requestCount: 5,
    bounds: {
        dataDir,
        rawFileName,
        fullLoopsFileName,
        outputFileName,
    },
};
