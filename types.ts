
export enum GameState {
    INTRO = 0, MENU = 1, LEVEL_SELECT = 2, BOSS_TRAINING_SELECT = 3,
    SKINS = 4, SETTINGS = 5, TUTORIAL = 6, COUNTDOWN = 7,
    PLAYING = 8, BOSS_WARNING = 9, VICTORY = 10, GAME_OVER = 11,
    LEVEL_TEST = 12
}

export type ThemeType = 'nebulosa' | 'supernova' | 'abismo' | 'vortex' | 'estelar';

export interface SaveData {
    maxLevel: number;
    highScore: number;
    theme: ThemeType;
    language: string;
    tutorialSeen: boolean;
    maxBossUnlocked: number;
}

export interface Player {
    x: number;
    y: number;
    size: number;
    color: string;
    speed: number;
}

export interface Bullet {
    x: number;
    y: number;
    size: number;
    color?: string;
    speed: number;
    vx?: number;
    vy?: number;
    type?: string;
}

export interface Enemy {
    x: number;
    y: number;
    size: number;
    speed: number;
    vx?: number;
    color: string;
    bossProjectile?: boolean;
    isStick?: boolean;
    w?: number;
    h?: number;
}

export interface Boss {
    x: number;
    y: number;
    size: number;
    health: number;
    maxHealth: number;
    vx: number;
    vy: number;
    patternTimer: number;
    attackInterval: number;
    hit: boolean;
    color: string;
    isDying: boolean;
    deathTimer: number;
    lastRainHp: number;
    hasFakedDeath?: boolean;
}

export interface Powerup {
    x: number;
    y: number;
    size: number;
    type: string;
    color: string;
}

export interface TrailPart {
    x: number;
    y: number;
    size: number;
    color: string;
    life: number;
}

export interface Star {
    x: number;
    y: number;
    size: number;
    speed: number;
}
