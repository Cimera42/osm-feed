import {Embed, randomColor} from '../../lib/apis/discord';
import {ProfileCache} from './profileCache';
import {ChangesetDetails} from '../../types';

export const makeEmbedFromChange = (
    change: ChangesetDetails,
    imageUrl: string | null = null
): Embed => ({
    title: change.id,
    description: change.comment,
    url: `https://www.openstreetmap.org/changeset/${change.id}`,
    color: randomColor(),
    timestamp: change.time,
    author: {
        name: change.username,
        url: encodeURI(`https://www.openstreetmap.org/user/${change.username}`),
        ...(imageUrl ? {icon_url: imageUrl} : {}),
    },
    footer: {
        text: `${change.count} changes`,
    },
});

export const makeFullEmbedForChange = async (
    change: ChangesetDetails,
    profileCache: ProfileCache
): Promise<Embed> => {
    const imageUrl = await profileCache.get(change.uid);
    return makeEmbedFromChange(change, imageUrl);
};
