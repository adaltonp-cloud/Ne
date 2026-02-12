
import { SaveData, ThemeType } from '../types';

const SAVE_KEY = 'neon_dash_ultimate_v2';

export const SaveService = {
    save: (data: Partial<SaveData>) => {
        const current = SaveService.load();
        localStorage.setItem(SAVE_KEY, JSON.stringify({ ...current, ...data }));
    },
    load: (): SaveData => {
        const data = localStorage.getItem(SAVE_KEY);
        const defaultData: SaveData = {
            maxLevel: 1,
            highScore: 0,
            theme: 'nebulosa',
            language: 'pt_BR',
            tutorialSeen: false,
            maxBossUnlocked: 0
        };
        if (!data) return defaultData;
        try {
            return { ...defaultData, ...JSON.parse(data) };
        } catch {
            return defaultData;
        }
    }
};
