import {promises as fs} from 'fs';
import {SettingsData} from '../types';
import Logger from './log';

export class Settings {
    public settings: SettingsData;
    private logger = new Logger('SETTINGS');

    constructor(private readonly settingsFile: string) {}

    async readSettings(): Promise<void> {
        try {
            const settingsValue = await fs.readFile(this.settingsFile, 'utf-8');
            this.settings = JSON.parse(settingsValue);
            this.logger.debug('Read settings as:');
            this.logger.debug(JSON.stringify(this.settings));
        } catch (error) {
            throw new Error(error);
        }
    }

    async writeSettings(): Promise<void> {
        try {
            this.logger.debug('Wrote settings as:');
            this.logger.debug(JSON.stringify(this.settings));
            return fs.writeFile(this.settingsFile, JSON.stringify(this.settings, null, 4), 'utf-8');
        } catch (error) {
            throw new Error(error);
        }
    }
}
