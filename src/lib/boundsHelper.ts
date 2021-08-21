import {promises as fs} from 'fs';
import {BoundsFile, Point, SmallPoint} from './geometry/common';
import {insideConvex, pointInsideBounds} from './geometry/point_inside';
import Logger from './log';

export class BoundsHelper {
    public bounds: BoundsFile;
    private logger = new Logger('BOUNDS-HELPER');

    constructor(private readonly boundsFile: string) {}

    async read(): Promise<void> {
        try {
            const boundsString = await fs.readFile(this.boundsFile, 'utf-8');
            this.bounds = JSON.parse(boundsString);
            this.logger.info(
                `Loaded file ${this.boundsFile}. Contains countries: ${Object.keys(
                    this.bounds
                ).join(', ')}`
            );
        } catch (error) {
            if (error?.code === 'ENOENT') {
                this.logger.error(
                    'Country bounds file does not exist. Please run the "bounds <country>" command to generate it.'
                );
            }
            throw new Error(error);
        }
    }

    static expandPoint = (p: SmallPoint): Point => {
        return {lat: p[0], lon: p[1]};
    };

    pointInBounds = (lat: number, lon: number): boolean => {
        const p = {
            lat,
            lon,
        };
        for (const countryName in this.bounds) {
            const country = this.bounds[countryName];
            for (const loop of country.loops) {
                const inbounds = pointInsideBounds(loop.bb, p);
                const inconvex = insideConvex(loop.p.map(BoundsHelper.expandPoint), p);
                if (inbounds && inconvex) {
                    return true;
                }
            }
        }
        return false;
    };
}
