import axios from 'axios';
import log from '../log';

const api = 'https://lz4.overpass-api.de/api/interpreter';

export namespace Overpass {
    export interface OverpassBaseResponse {
        version: number;
        generator: string;
        osm3s: {
            timestamp_osm_base: string;
            copyright: string;
        };
    }

    export interface OverpassResponse<T> extends OverpassBaseResponse {
        elements: T[];
    }

    export interface RelationElement<T> {
        type: 'relation';
        id: number;
        bounds: {
            minlat: number;
            minlon: number;
            maxlat: number;
            maxlon: number;
        };
        members: T[];
        tags: Tags;
    }

    export interface Geometry {
        lat: number;
        lon: number;
    }

    export interface Node {
        type: 'node';
        ref: number;
        role: string;
        lat: number;
        lon: number;
    }

    export interface Way {
        type: 'way';
        ref: number;
        role: string;
        geometry: Geometry[];
    }

    export interface Relation {
        type: 'relation';
        ref: number;
        role: string;
    }

    export interface Tags {
        type: string;
        [key: string]: string;
    }
}

const query = async <T>(overpassQL: string) => {
    return await axios.post<Overpass.OverpassResponse<T>>(
        api,
        `data=${encodeURIComponent(overpassQL)}`,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;',
            },
        }
    );
};

export const getCountryGeometry = async (country: string) => {
    const queryString = `[out:json];relation[boundary="administrative"][admin_level="2"][type="boundary"][int_name="${country}"][type!=multilinestring];out geom;`;
    return await query<Overpass.RelationElement<Overpass.Node | Overpass.Way | Overpass.Relation>>(
        queryString
    );
};
