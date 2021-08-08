import axios from 'axios';
import {Readable} from 'stream';
import {pad3} from '../../helpers';
import {ChangesetDetails, ChangesetDetailsResponse, FilteredNode} from '../../types';

const minuteURL = 'https://planet.openstreetmap.org/replication/minute/';

export const getLatestSequenceNumber = async (): Promise<number> => {
    const response = await axios.get<string>(`${minuteURL}state.txt`);
    const match = response.data.match(/sequenceNumber=(\d+)/);
    if (!match) {
        throw new Error('Could not get latest sequence number.');
    }
    return parseInt(match[1]);
};

export const getURLForSequenceNumber = (id: number): string => {
    const f1 = pad3(Math.floor(id / 1000000));
    const f2 = pad3(Math.floor((id / 1000) % 1000));
    const f3 = pad3(Math.floor(id % 1000));
    return `${minuteURL}${f1}/${f2}/${f3}.osc.gz`;
};

export const getChangesetDetails = async (info: FilteredNode): Promise<ChangesetDetails> => {
    const {changeset, timestamp} = info;

    const response = await axios.get<ChangesetDetailsResponse>(
        `https://www.openstreetmap.org/api/0.6/changeset/${changeset}.json`
    );

    const element = response.data.elements[0];
    return {
        id: changeset,
        uid: element.uid,
        username: element.user,
        count: element.changes_count,
        comment: element.tags?.comment || '(no comment)',
        time: timestamp,
    };
};

export const getSequenceDataStream = async (sequenceNumber: number): Promise<Readable> => {
    const url = getURLForSequenceNumber(sequenceNumber);
    const response = await axios.get<Readable>(url, {responseType: 'stream'});
    return response.data;
};
