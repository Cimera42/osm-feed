import {Point} from './common';

const getLowestLeft = (loop: Point[]) => {
    let p = loop[0];
    for (const point of loop) {
        if (point.lat < p.lat) {
            p = point;
        } else if (point.lat == p.lat && point.lon < p.lon) {
            p = point;
        }
    }
    return p;
};

const getPolarAngle = (p0: Point, p1: Point) => {
    return Math.atan2(p1.lat - p0.lat, p1.lon - p0.lon);
};

const sq = (n: number) => {
    return n * n;
};

const getSqDistance = (p0: Point, p1: Point) => {
    return sq(p1.lat - p0.lat) + sq(p1.lon - p0.lon);
};

const getPolarPoints = (p0: Point, loop: Point[]) => {
    const polarPoints = loop.map((point) => ({
        ...point,
        ang: getPolarAngle(p0, point),
        dist: getSqDistance(p0, point),
    }));

    const furthestPolarPoints: Record<string, typeof polarPoints[0]> = {};
    polarPoints.forEach((point) => {
        if (point.ang in furthestPolarPoints) {
            if (point.dist > furthestPolarPoints[point.ang].dist) {
                furthestPolarPoints[point.ang] = point;
            }
        } else {
            furthestPolarPoints[point.ang] = point;
        }
    });

    const sortedPoints = Object.values(furthestPolarPoints).sort((a, b) => a.ang - b.ang);
    return sortedPoints;
};

const ccw = (p0: Point, p1: Point, p2: Point) => {
    return (p1.lon - p0.lon) * (p2.lat - p0.lat) - (p2.lon - p0.lon) * (p1.lat - p0.lat);
};

const graham_scan = (loop: Point[]): Point[] => {
    const stack: Point[] = [];
    const p0 = getLowestLeft(loop);

    const polar_points = getPolarPoints(p0, loop);
    polar_points.forEach((point) => {
        while (stack.length > 1 && ccw(stack[-2], stack[-1], point) <= 0) {
            delete stack[-1];
        }
        stack.push(point);
    });

    return stack;
};

export default graham_scan;
