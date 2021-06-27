import {promises as fs} from 'fs';
import log from './log';
import {SettingsData} from './types';

export class Settings {
    public settings: SettingsData;

    constructor(private readonly settingsFile: string) {}

    async readSettings() {
        const settingsValue = await fs.readFile(this.settingsFile, 'utf-8');
        this.settings = JSON.parse(settingsValue);
        log('Read settings as:');
        log(this.settings);
    }

    async writeSettings() {
        log('Wrote settings as:');
        log(this.settings);
        return fs.writeFile(this.settingsFile, JSON.stringify(this.settings, null, 4), 'utf-8');
    }
}
