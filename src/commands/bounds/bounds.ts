import {promises as fs} from 'fs';
import {getCountryGeometry, Overpass} from '../../lib/apis/overpass';
import {BoundsFile, Point} from '../../lib/geometry/common';
import grahamScan from '../../lib/geometry/graham_scan';
import {getBounds} from '../../lib/geometry/point_inside';
import log from '../../log';
import mergeLoops from './merge_loops';

const geomToStr = (node: Overpass.Geometry | Point) => `${node.lon},${node.lat}`;

const generateCountryBounds = async (country: string): Promise<void> => {
    log(country);

    // const response = await getCountryGeometry(country);
    // const overpassData = response.data;
    // await fs.writeFile('raw.json', JSON.stringify(overpassData, null, 4));
    const overpassData: Overpass.OverpassResponse<
        Overpass.RelationElement<Overpass.Node | Overpass.Way | Overpass.Relation>
    > = JSON.parse(await fs.readFile('data/raw.json', 'utf-8'));
    if (overpassData.elements.length > 0) {
        const relation = overpassData.elements.find((element) => element.type === 'relation');
        if (relation) {
            const boundaries = relation.members.filter(
                (member): member is Overpass.Way => member.type === 'way' && member.role === 'outer'
            );

            const merged = mergeLoops(boundaries);

            // Write to file for python notebook
            await fs.writeFile(
                'data/loops.json',
                JSON.stringify(merged.sort((a, b) => b.length - a.length))
            );

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
            await fs.writeFile('data/countryBounds.json', JSON.stringify(output));
        }
    }
};

export default generateCountryBounds;
