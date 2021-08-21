import {Overpass} from '../../lib/apis/overpass';

const compareLatLng = (a: Overpass.Geometry, b: Overpass.Geometry) =>
    a.lat === b.lat && a.lon === b.lon;

const mergeLoops = (members: Overpass.Way[]): Overpass.Geometry[][] => {
    const merged: Overpass.Geometry[][] = [];
    const processed: number[] = [];

    for (let i = 0; i < members.length; i++) {
        const list: Overpass.Geometry[] = [];
        let next = i;
        let invert = false;

        if (processed.indexOf(next) !== -1) {
            continue;
        }
        while (1) {
            let geom = members[next].geometry;
            if (invert) {
                geom = geom.reverse();
            }

            list.push(...geom.slice(next === i ? 0 : 1));
            processed.push(next);

            let toBeNext = members.findIndex(
                (_, otherIndex) =>
                    otherIndex !== next &&
                    compareLatLng(
                        members[next].geometry[members[next].geometry.length - 1],
                        members[otherIndex].geometry[0]
                    )
            );
            invert = false;
            if (toBeNext === -1) {
                toBeNext = members.findIndex(
                    (_, otherIndex) =>
                        otherIndex !== next &&
                        compareLatLng(
                            members[next].geometry[members[next].geometry.length - 1],
                            members[otherIndex].geometry[members[otherIndex].geometry.length - 1]
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

    return merged;
};

export default mergeLoops;
