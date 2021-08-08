export interface Point {
    lat: number;
    lon: number;
}

export type Bounds = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};

export enum CrossingDirection {
    DOWNWARD = 1,
    UPWARD = -1,
    NOT_CROSSING = 0,
}
