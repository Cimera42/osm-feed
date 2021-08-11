import {promises as fs} from 'fs';
import {getCountryGeometry, Overpass} from '../../lib/apis/overpass';
import {BoundsFile} from '../../lib/geometry/common';
import grahamScan from '../../lib/geometry/graham_scan';
import {getBounds} from '../../lib/geometry/point_inside';
import log from '../../log';
import mergeLoops from './merge_loops';

const dataDir = 'data';
const rawFileName = `${dataDir}/raw.json`;
const fullLoopsFileName = `${dataDir}/loops.json`;
const outputFileName = `${dataDir}/countryBounds.json`;

const generateCountryBounds = async (country: string, dev = false): Promise<void> => {
    log(`Generating bounds for country: "${country}"`);

    try {
        await fs.mkdir(dataDir);
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }

    let overpassData: Overpass.OverpassResponse<
        Overpass.RelationElement<Overpass.Node | Overpass.Way | Overpass.Relation>
    >;

    if (
        !dev ||
        (await fs
            .stat(rawFileName)
            .then(() => false)
            .catch(() => true))
    ) {
        log(`Fetching OSM data`);

        const response = await getCountryGeometry(country);
        overpassData = response.data;

        if (dev) {
            log(`Saving OSM data to cache`);
            await fs.writeFile(rawFileName, JSON.stringify(overpassData, null, 4));
        }
    } else if (dev) {
        log(`Loading cached OSM data`);
        overpassData = JSON.parse(await fs.readFile(rawFileName, 'utf-8'));
    }

    if (overpassData.elements.length > 0) {
        const relation = overpassData.elements.find((element) => element.type === 'relation');
        if (relation) {
            const boundaries = relation.members.filter(
                (member): member is Overpass.Way => member.type === 'way' && member.role === 'outer'
            );

            const merged = mergeLoops(boundaries);

            if (dev) {
                // Write to file for python notebook
                await fs.writeFile(
                    fullLoopsFileName,
                    JSON.stringify(merged.sort((a, b) => b.length - a.length))
                );
            }

            const convexBoundaries = merged.map((loop) => grahamScan(loop));

            const output: BoundsFile = {
                [country]: {
                    country,
                    loops: convexBoundaries.map((boundary) => ({
                        bb: getBounds(boundary),
                        p: boundary.map((p) => [p.lat, p.lon]),
                    })),
                },
            };
            await fs.writeFile(outputFileName, JSON.stringify(output));
        }
    }

    log(`Completed generating bounds for country: "${country}"`);
};

export default generateCountryBounds;
