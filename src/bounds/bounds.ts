import {promises as fs} from 'fs';
import {getCountryGeometry, Overpass} from '../apis/overpass';
import log from '../log';
import {Bounds} from '../types';

const generateCountryBounds = async (country: string) => {
    log(country);
    let bounds: Bounds;

    // const response = await getCountryGeometry(country);
    // const overpassData = response.data;
    // await fs.writeFile('raw.json', JSON.stringify(overpassData, null, 4));
    const overpassData: Overpass.OverpassResponse<
        Overpass.RelationElement<Overpass.Node | Overpass.Way | Overpass.Relation>
    > = JSON.parse(await fs.readFile('data/raw.json', 'utf-8'));
    if (overpassData.elements.length > 0) {
        const relation = overpassData.elements.find((element) => element.type === 'relation');
        if (relation) {
            bounds = {
                top: relation.bounds.maxlat,
                bottom: relation.bounds.minlat,
                left: relation.bounds.minlon,
                right: relation.bounds.maxlon,
            };

            const boundaries = relation.members.filter(
                (member): member is Overpass.Way => member.type === 'way' && member.role === 'outer'
            );

            // const toMerge: {index: number; previous: number; next: number; processed: boolean}[] =
            //     boundaries.map((boundary, i) => ({
            //         index: i,
            //         previous: -1,
            //         next: -1,
            //         processed: false,
            //     }));
            // toMerge.forEach(({index, previous, next}) => {
            //     // if (previous === -1) {
            //     //     const found = toMerge.findIndex(
            //     //         ({index: otherIndex}) =>
            //     //             otherIndex != index &&
            //     //             toMerge[otherIndex].next === -1 &&
            //     //             compareLatLng(
            //     //                 boundaries[index].geometry[0],
            //     //                 boundaries[otherIndex].geometry[
            //     //                     boundaries[otherIndex].geometry.length - 1
            //     //                 ]
            //     //             )
            //     //     );
            //     //     if (found >= 0) {
            //     //         toMerge[index].previous = found;
            //     //         toMerge[found].next = index;
            //     //     }
            //     // }
            //     if (next === -1) {
            //         const found = toMerge.findIndex(
            //             ({index: otherIndex}) =>
            //                 otherIndex != index &&
            //                 toMerge[otherIndex].previous === -1 &&
            //                 compareLatLng(
            //                     boundaries[index].geometry[boundaries[index].geometry.length - 1],
            //                     boundaries[otherIndex].geometry[0]
            //                 )
            //         );
            //         if (found >= 0) {
            //             toMerge[index].next = found;
            //             toMerge[found].previous = index;
            //         }
            //     }
            // });

            // let n = 1;
            // log('loop');
            // do {
            //     log(n);
            //     n = toMerge[n].next;
            // } while (n !== 1 && n !== -1);
            // log('endloop');

            const merged: Overpass.Geometry[][] = [];
            const processed: number[] = [];

            for (let i = 0; i < boundaries.length; i++) {
                const list: Overpass.Geometry[] = [];
                let next = i;
                let invert = false;

                if (processed.indexOf(next) !== -1) {
                    continue;
                }
                while (1) {
                    let geom = boundaries[next].geometry;
                    if (invert) {
                        geom = geom.reverse();
                    }

                    list.push(...geom.slice(next === i ? 0 : 1));
                    processed.push(next);

                    let toBeNext = boundaries.findIndex(
                        (_, otherIndex) =>
                            otherIndex !== next &&
                            compareLatLng(
                                boundaries[next].geometry[boundaries[next].geometry.length - 1],
                                boundaries[otherIndex].geometry[0]
                            )
                    );
                    invert = false;
                    if (toBeNext === -1) {
                        toBeNext = boundaries.findIndex(
                            (_, otherIndex) =>
                                otherIndex !== next &&
                                compareLatLng(
                                    boundaries[next].geometry[boundaries[next].geometry.length - 1],
                                    boundaries[otherIndex].geometry[
                                        boundaries[otherIndex].geometry.length - 1
                                    ]
                                )
                        );
                        invert = true;
                    }

                    if (toBeNext === -1 || toBeNext === i) {
                        break;
                    }
                    next = toBeNext;
                }
                if (list.length) {
                    // TODO prevent this in actual algo
                    if (list.length > 1 && compareLatLng(list[0], list[list.length - 1])) {
                        merged.push(list.slice(1));
                    } else {
                        merged.push(list);
                    }
                }
            }
            log(merged.length);

            const largestLoop = merged.reduce(
                (loop, acc) => (loop.length > acc.length ? loop : acc),
                []
            );
            await fs.writeFile(
                'data/loops.json',
                JSON.stringify(
                    merged.sort((a, b) => b.length - a.length),
                    null,
                    4
                )
            );
            await fs.writeFile(
                'data/loops.txt',
                merged.map((loop) => loop.map(geomToStr).join('\n')).join('\n')
            );
        }
    }
};

export default generateCountryBounds;

const compareLatLng = (a: Overpass.Geometry, b: Overpass.Geometry) =>
    a.lat === b.lat && a.lon === b.lon;

const geomToStr = (node: Overpass.Geometry) => `${node.lon}, ${node.lat}`;
