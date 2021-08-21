import axios from 'axios';
import Logger from '../../lib/log';
import {UserResponse} from '../../types';

export class ProfileCache {
    cache: Map<number, Promise<string | null>>;
    logger = new Logger('PROFILE-CACHE');

    constructor() {
        this.cache = new Map();
    }

    get(userId: number): Promise<string> {
        const cached = this.cache.get(userId);
        if (cached) {
            this.logger.info(`Using cached profile image for ${userId}`);
            return cached;
        } else {
            const get = axios
                .get<UserResponse>(`https://api.openstreetmap.org/api/0.6/user/${userId}.json`)
                .then((response) => {
                    const url = response.data.user.img?.href || null;
                    this.logger.info(`Cached profile image for ${userId} as ${url}`);
                    return url;
                })
                .catch((e) => {
                    // 410 Gone: user deleted
                    // Profile images are low-importance, log the error and move on
                    this.logger.warn(`Could not get profile image for ${userId}: ${e}`);
                    return null;
                });

            this.cache.set(userId, get);
            return get;
        }
    }
}
