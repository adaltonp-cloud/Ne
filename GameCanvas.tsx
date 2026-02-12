
import React, { useRef, useEffect, useCallback } from 'react';
import { GameState, ThemeType, Player, Enemy, Bullet, Boss, Powerup, TrailPart, Star } from '../types';
import { audio } from '../services/audioService';
import { getTranslation } from '../constants';

interface GameCanvasProps {
    gameState: GameState;
    currentLevel: number;
    theme: ThemeType;
    language: string;
    trainingMode: boolean;
    onGameOver: (score: number) => void;
    onScoreUpdate: (score: number) => void;
    onLevelComplete: (level: number) => void;
    onBossWarning: () => void;
    onBossSpawned: () => void;
    onBossEncountered: (level: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
    gameState,
    currentLevel,
    theme,
    language,
    trainingMode,
    onGameOver,
    onScoreUpdate,
    onLevelComplete,
    onBossWarning,
    onBossSpawned,
    onBossEncountered
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dimensionsRef = useRef({ width: 400, height: 600 });
    const lastTimeRef = useRef<number>(performance.now());
    
    const stateRef = useRef({
        levelScore: 0, speed: 5, shield: false, invincible: false,
        weaponType: 'standard', weaponTimer: 0, screenShake: 0, flashEffect: 0,
        keys: {} as Record<string, boolean>,
        player: { x: 200, y: 500, size: 28, color: "#00d4ff", speed: 480 } as Player, // Speed em px/s
        enemies: [] as Enemy[], bullets: [] as Bullet[], particles: [] as any[],
        powerups: [] as Powerup[], trails: [] as TrailPart[],
        bosses: [] as Boss[], bossSpawnedInLevel: false, lastFire: 0, lastTap: 0, bgOffset: 0,
        bgStars: [] as Star[], blockRainTimer: 0, isBlockRainActive: false
    });

    const getThemeColors = () => {
        if (currentLevel === 1000) return { primary: '#ffffff', secondary: '#ff0000', bgHue: 0 };
        switch (theme) {
            case 'supernova': return { primary: '#f97316', secondary: '#ef4444', bgHue: 15 };
            case 'abismo': return { primary: '#22c55e', secondary: '#0ea5e9', bgHue: 140 };
            case 'vortex': return { primary: '#ec4899', secondary: '#ffffff', bgHue: 320 };
            case 'estelar': return { primary: '#eab308', secondary: '#ffffff', bgHue: 45 };
            default: return { primary: '#06b6d4', secondary: '#a855f7', bgHue: 190 };
        }
    };

    const initStars = (w: number, h: number) => {
        stateRef.current.bgStars = Array.from({ length: 40 }, () => ({
            x: Math.random() * w, y: Math.random() * h,
            size: Math.random() * 2 + 1, speed: Math.random() * 120 + 30
        }));
    };

    const triggerBossSpawn = useCallback(() => {
        const s = stateRef.current;
        const { width } = dimensionsRef.current;
        const colors = getThemeColors();
        s.bossSpawnedInLevel = true;
        s.enemies = [];
        s.powerups = [];
        onBossWarning();
        onBossEncountered(currentLevel);
        
        let baseHealth = 30 + (currentLevel * 10);
        let finalHealth = Math.min(25000, baseHealth + Math.floor(Math.pow(currentLevel, 1.25)));
        let vx = 240 + Math.min(720, currentLevel * 2.4); // Convertido para px/s
        let attackInterval = Math.max(0.08, 0.75 - (currentLevel / 1200)); // em segundos

        if (currentLevel === 1000) {
            finalHealth = 100000; 
            vx = 360;
            attackInterval = 0.25;
        }

        setTimeout(() => {
            const newBosses: Boss[] = [];
            if (currentLevel >= 100) {
                const totalWidth = 110 * 2 + 40;
                const startX = (width - totalWidth) / 2;
                newBosses.push(createBossObj(startX, -120, finalHealth, vx, attackInterval, currentLevel === 1000 ? '#ff0000' : colors.secondary));
                newBosses.push(createBossObj(startX + 150, -120, finalHealth, -vx, attackInterval, currentLevel === 1000 ? '#ff0000' : colors.secondary));
            } else {
                newBosses.push(createBossObj(width / 2 - 55, -120, finalHealth, vx, attackInterval, colors.secondary));
            }
            s.bosses = newBosses;
            onBossSpawned();
        }, 3000);
    }, [currentLevel, onBossWarning, onBossEncountered, onBossSpawned, theme]);

    const createBossObj = (x: number, y: number, health: number, vx: number, interval: number, color: string): Boss => ({
        x, y, size: 110, health, maxHealth: health, vx, vy: 90, patternTimer: 0,
        attackInterval: interval, hit: false, color, isDying: false, deathTimer: 0, lastRainHp: health,
        hasFakedDeath: false
    });

    const resetForLevel = useCallback(() => {
        const s = stateRef.current;
        const { width, height } = dimensionsRef.current;
        const colors = getThemeColors();
        s.speed = 330 + Math.min(840, currentLevel * 3.6); // pixels por segundo
        if (currentLevel === 1000) s.speed = 480;
        
        s.levelScore = trainingMode ? 9999 : 0;
        s.bossSpawnedInLevel = false;
        s.bosses = [];
        s.enemies = [];
        s.bullets = [];
        s.powerups = [];
        s.shield = false;
        s.invincible = false;
        s.weaponType = 'standard';
        s.weaponTimer = 0;
        s.player.color = colors.primary;
        s.player.x = width / 2 - s.player.size / 2;
        s.player.y = height - 100;
        s.isBlockRainActive = false;
        s.blockRainTimer = 0;
        if (trainingMode) triggerBossSpawn();
    }, [currentLevel, theme, trainingMode, triggerBossSpawn]);

    useEffect(() => {
        if (gameState === GameState.COUNTDOWN) resetForLevel();
    }, [gameState, resetForLevel]);

    const fireBullet = () => {
        const s = stateRef.current;
        const now = Date.now();
        const fireRate = s.weaponType === 'rapid' ? 70 : 170;
        if (now - s.lastFire > fireRate) {
            const centerY = s.player.y;
            if (s.weaponType === 'dual') {
                s.bullets.push({ x: s.player.x - 5, y: centerY, size: 8, color: '#fff', speed: 1200 });
            } else if (s.weaponType === 'dual_right') { // Helper para lógica dual
                // Dual logic handled inside push below
            }

            if (s.weaponType === 'dual') {
                s.bullets.push({ x: s.player.x + s.player.size + 5, y: centerY, size: 8, color: '#fff', speed: 1200 });
            } else if (s.weaponType === 'big') {
                s.bullets.push({ x: s.player.x + s.player.size / 2 - 15, y: centerY - 10, size: 30, color: '#ffaa00', speed: 720, type: 'big' });
            } else if (s.weaponType === 'split') {
                s.bullets.push({ x: s.player.x + s.player.size / 2 - 5, y: centerY, size: 10, color: '#00ffaa', speed: 1080, type: 'split' });
            } else if (s.weaponType === 'toxic') {
                s.bullets.push({ x: s.player.x + s.player.size / 2 - 3, y: centerY - 20, size: 6, color: '#a3e635', speed: 2100, type: 'toxic' });
                s.weaponType = 'standard';
                s.weaponTimer = 0;
            } else {
                s.bullets.push({ x: s.player.x + s.player.size / 2 - 4, y: s.player.y, size: 8, color: '#fff', speed: 1200 });
            }
            s.lastFire = now;
            audio.playShoot();
        }
    };

    const handleTouchStart = (e: TouchEvent) => {
        const s = stateRef.current;
        if (gameState !== GameState.PLAYING && gameState !== GameState.BOSS_WARNING) return;
        const now = Date.now();
        if (s.weaponType === 'rapid' || s.weaponType === 'toxic' || (now - s.lastTap < 280 && s.bosses.length > 0)) fireBullet();
        s.lastTap = now;
    };

    const handleTouchMove = (e: TouchEvent) => {
        const allowed = [GameState.PLAYING, GameState.COUNTDOWN, GameState.BOSS_WARNING];
        if (!allowed.includes(gameState)) return;
        if (e.cancelable) e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const s = stateRef.current;
        const { width, height } = dimensionsRef.current;
        const touch = e.touches[0];
        const targetX = ((touch.clientX - rect.left) / rect.width) * width - s.player.size / 2;
        const targetY = ((touch.clientY - rect.top) / rect.height) * height - s.player.size / 2;
        s.player.x = Math.max(0, Math.min(width - s.player.size, targetX));
        s.player.y = Math.max(0, Math.min(height - s.player.size, targetY));
        if (s.weaponType === 'rapid') fireBullet();
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => stateRef.current.keys[e.key] = true;
        const onKeyUp = (e: KeyboardEvent) => stateRef.current.keys[e.key] = false;
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
            canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        }
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            if (canvas) {
                canvas.removeEventListener("touchstart", handleTouchStart);
                canvas.removeEventListener("touchmove", handleTouchMove);
            }
        };
    }, [gameState]);

    const update = (dt: number) => {
        const s = stateRef.current;
        const { width, height } = dimensionsRef.current;
        const colors = getThemeColors();
        
        // Background Scroll Speed
        const bgScrollSpeed = currentLevel === 1000 ? 240 : 270;
        s.bgOffset = (s.bgOffset + bgScrollSpeed * dt) % 50;
        s.bgStars.forEach(star => star.y = (star.y + star.speed * dt) % height);
        
        if (![GameState.PLAYING, GameState.COUNTDOWN, GameState.BOSS_WARNING].includes(gameState)) return;

        if (s.weaponTimer > 0) {
            s.weaponTimer -= dt;
            if (s.weaponTimer <= 0) s.weaponType = 'standard';
        }

        const moveSpeed = s.player.speed * dt;
        if ((s.keys["ArrowLeft"] || s.keys["a"]) && s.player.x > 0) s.player.x -= moveSpeed;
        if ((s.keys["ArrowRight"] || s.keys["d"]) && s.player.x < width - s.player.size) s.player.x += moveSpeed;
        if ((s.keys["ArrowUp"] || s.keys["w"]) && s.player.y > 0) s.player.y -= moveSpeed;
        if ((s.keys["ArrowDown"] || s.keys["s"]) && s.player.y < height - s.player.size) s.player.y += moveSpeed;
        if (s.keys[" "] || s.weaponType === 'rapid') fireBullet();

        if (gameState === GameState.PLAYING) {
            const pointsToBoss = Math.min(400, 60 + (currentLevel * 4));
            if (!trainingMode && s.levelScore >= pointsToBoss && !s.bossSpawnedInLevel) triggerBossSpawn();
            
            if (s.blockRainTimer > 0) {
                s.blockRainTimer -= dt;
                const rainDensity = currentLevel === 1000 ? 6 : 15; // Itens por segundo aprox
                if (Math.random() < rainDensity * dt) {
                   s.enemies.push({ 
                       x: Math.random() * (width - 6), 
                       y: -50, w: currentLevel === 1000 ? 6 : 4, h: 50, 
                       speed: (currentLevel === 1000 ? 600 : 960) + Math.random() * 360, 
                       color: '#fff', isStick: true, size: 4 
                   });
                }
                if (s.blockRainTimer <= 0) {
                    s.isBlockRainActive = false;
                    s.enemies = s.enemies.filter(e => !e.isStick);
                    s.bosses.forEach(b => b.lastRainHp = b.health);
                }
            }

            for (let i = s.bosses.length - 1; i >= 0; i--) {
                const b = s.bosses[i];
                if (b.isDying) {
                    b.deathTimer -= dt;
                    if (b.deathTimer <= 0) {
                        if (currentLevel >= 30 && !b.hasFakedDeath) {
                            b.health = b.maxHealth * (currentLevel === 1000 ? 0.6 : 0.5);
                            b.isDying = false;
                            b.hasFakedDeath = true;
                            s.flashEffect = 1;
                            s.screenShake = 100;
                            audio.playStart();
                        } else {
                            s.bosses.splice(i, 1);
                            audio.playBossExplosion();
                            if (s.bosses.length === 0) onLevelComplete(currentLevel);
                        }
                    }
                    continue;
                }
                
                if (currentLevel >= 10 && !s.isBlockRainActive) {
                    const hpThreshold = currentLevel === 1000 ? 0.15 : 0.20;
                    const hpPerTrigger = b.maxHealth * hpThreshold;
                    if (b.health <= b.lastRainHp - hpPerTrigger) {
                        b.lastRainHp = b.health;
                        s.isBlockRainActive = true;
                        s.blockRainTimer = currentLevel === 1000 ? 4.1 : 7.0; // segundos
                        s.enemies = [];
                        s.powerups = [];
                    }
                }

                if (b.y < 80) b.y += b.vy * dt * (currentLevel === 1000 ? 0.8 : 1);
                else if (!s.isBlockRainActive) {
                    b.x += b.vx * dt;
                    if (b.x < 0 || b.x + b.size > width) b.vx *= -1;
                    
                    b.patternTimer += dt;
                    if (b.patternTimer >= b.attackInterval) {
                        b.patternTimer = 0;
                        const isPhase2 = b.health < b.maxHealth * 0.5;
                        const isAngry = b.health < b.maxHealth * 0.2;
                        
                        let projectileCount = isPhase2 ? 3 : 1;
                        if (isAngry) projectileCount = 4;
                        if (currentLevel >= 100 && isPhase2) projectileCount = 5;
                        if (currentLevel === 1000) projectileCount = 2;

                        for (let k = 0; k < projectileCount; k++) {
                            const spreadMult = currentLevel === 1000 ? 270 : 150; 
                            const spread = (k - (projectileCount - 1) / 2) * spreadMult;
                            const pSpeed = (currentLevel === 1000 ? 420 : 600) + Math.min(720, currentLevel * 3.6);
                            s.enemies.push({ 
                                x: b.x + b.size / 2 + (spread * 0.1), 
                                y: b.y + b.size, 
                                size: currentLevel === 1000 ? 18 : 22, 
                                speed: pSpeed, 
                                vx: spread, 
                                color: b.color, 
                                bossProjectile: true 
                            });
                        }
                    }
                }

                if (!s.invincible && s.player.x < b.x + b.size && s.player.x + s.player.size > b.x && s.player.y < b.y + b.size && s.player.y + s.player.size > b.y) {
                    handlePlayerHit();
                }
            }
            
            for (let i = s.bullets.length - 1; i >= 0; i--) {
                const bullet = s.bullets[i];
                bullet.y -= bullet.speed * dt;
                if (bullet.vx) bullet.x += bullet.vx * dt;
                
                let hit = false;
                for (const b of s.bosses) {
                    if (b.isDying) continue;
                    if (bullet.x < b.x + b.size && bullet.x + bullet.size > b.x && bullet.y < b.y + b.size && bullet.y + bullet.size > b.y) {
                        let damage = bullet.type === 'big' ? 15 : 1;
                        if (bullet.type === 'toxic') {
                            damage = b.maxHealth * 0.10;
                            s.flashEffect = 0.3;
                            s.screenShake = 60;
                        } else {
                            damage *= (currentLevel === 1000 ? 20 : 1);
                        }

                        b.health -= damage;
                        b.hit = true;
                        s.screenShake = Math.max(s.screenShake, bullet.type === 'big' ? 45 : 25);
                        audio.playBossHit();
                        
                        if (bullet.type === 'split') {
                            for (let j = 0; j < 3; j++) s.bullets.push({ x: bullet.x, y: bullet.y, size: 6, color: '#00ffaa', speed: 720, vx: (j - 1) * 240 });
                        }
                        
                        s.bullets.splice(i, 1);
                        hit = true;
                        if (b.health <= 0) {
                            b.isDying = true;
                            b.deathTimer = 3.0; // 3 segundos
                            if (s.isBlockRainActive) {
                                s.isBlockRainActive = false;
                                s.enemies = s.enemies.filter(e => !e.isStick);
                            }
                        }
                        setTimeout(() => { if (b) b.hit = false }, 50);
                        break;
                    }
                }
                if (!hit && (bullet.y < -150 || bullet.y > height + 150)) s.bullets.splice(i, 1);
            }

            const spawnChance = trainingMode ? 0 : 5 + Math.min(25, currentLevel * 0.06); // Inimigos por segundo
            if (s.bosses.length === 0 && Math.random() < spawnChance * dt && !s.isBlockRainActive) {
                const eSpeed = s.speed + Math.random() * Math.min(840, 360 + (currentLevel * 1.5));
                s.enemies.push({ x: Math.random() * (width - 30), y: -40, size: 28, speed: eSpeed, color: colors.secondary });
            }

            const pChance = currentLevel === 1000 ? 4.8 : 0.9; // Powerups por segundo
            if (Math.random() < pChance * dt && !s.isBlockRainActive) {
                let type = Math.random() > 0.7 ? 'shield' : (s.bosses.length > 0 ? 'shield' : 'point');
                const rand = Math.random();
                if (currentLevel >= 5 && rand < 0.2) type = 'dual';
                else if (currentLevel >= 12 && rand < 0.35) type = 'rapid';
                else if (currentLevel >= 25 && rand < 0.5) type = 'split';
                else if (currentLevel >= 40 && rand < 0.65) type = 'big';
                
                if (currentLevel >= 50 && Math.random() < 0.08) type = 'toxic';
                
                s.powerups.push({ x: Math.random() * (width - 25), y: -40, size: 28, type, color: '#fff' });
            }

            for (let i = s.enemies.length - 1; i >= 0; i--) {
                const e = s.enemies[i];
                e.y += e.speed * dt;
                if (e.vx) e.x += e.vx * dt;
                
                const ex = e.x, ey = e.y, ew = e.isStick ? (e.w || 4) : e.size, eh = e.isStick ? (e.h || 50) : e.size;
                if (!s.invincible && s.player.x < ex + ew && s.player.x + s.player.size > ex && s.player.y < ey + eh && s.player.y + s.player.size > ey) {
                    handlePlayerHit();
                    s.enemies.splice(i, 1);
                    continue;
                }
                if (e.y > height + 50 || e.x < -100 || e.x > width + 100) {
                    s.enemies.splice(i, 1);
                    if (s.bosses.length === 0 && !e.bossProjectile && !e.isStick) {
                        s.levelScore++;
                        onScoreUpdate(s.levelScore);
                    }
                }
            }

            for (let i = s.powerups.length - 1; i >= 0; i--) {
                const p = s.powerups[i];
                p.y += 360 * dt;
                if (s.player.x < p.x + p.size && s.player.x + s.player.size > p.x && s.player.y < p.y + p.size && s.player.y + p.size > p.y) {
                    audio.playCollect();
                    if (p.type === 'shield') s.shield = true;
                    else if (p.type === 'point') {
                        s.levelScore += 25;
                        onScoreUpdate(s.levelScore);
                    } else {
                        s.weaponType = p.type;
                        s.weaponTimer = p.type === 'toxic' ? 99999 : (currentLevel === 1000 ? 12 : 7.5);
                    }
                    s.powerups.splice(i, 1);
                } else if (p.y > height) {
                    s.powerups.splice(i, 1);
                }
            }
        }

        function handlePlayerHit() {
            if (s.weaponType !== 'standard' && s.weaponType !== 'toxic') {
                s.weaponType = 'standard';
                s.weaponTimer = 0;
                s.invincible = true;
                s.flashEffect = 0.5;
                audio.playShieldLost();
                setTimeout(() => s.invincible = false, 1000);
            } else if (s.shield) {
                s.shield = false;
                s.invincible = true;
                s.flashEffect = 1;
                audio.playShieldLost();
                setTimeout(() => s.invincible = false, 1500);
            } else {
                onGameOver(s.levelScore);
            }
        }

        if (Math.random() < 0.6) {
           s.trails.push({ x: s.player.x + s.player.size / 2, y: s.player.y + s.player.size / 2, size: s.player.size, color: s.player.color, life: 1 });
        }
        for (let i = s.trails.length - 1; i >= 0; i--) {
            s.trails[i].life -= 9 * dt;
            if (s.trails[i].life <= 0) s.trails.splice(i, 1);
        }
        if (s.screenShake > 0) s.screenShake *= 0.95;
        if (s.flashEffect > 0) s.flashEffect -= 4 * dt;
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        const s = stateRef.current;
        const { width, height } = dimensionsRef.current;
        const colors = getThemeColors();
        
        ctx.save();
        if (s.screenShake > 0.1) ctx.translate(Math.random() * s.screenShake - s.screenShake / 2, Math.random() * s.screenShake - s.screenShake / 2);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Stars - optimized without shadow for BG
        ctx.fillStyle = `hsla(${colors.bgHue}, 100%, 75%, 0.4)`;
        for(let i=0; i<s.bgStars.length; i++){
            const star = s.bgStars[i];
            ctx.fillRect(star.x, star.y, star.size, star.size);
        }
        
        ctx.strokeStyle = `hsla(${colors.bgHue}, 60%, 40%, 0.15)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = s.bgOffset; y <= height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();

        for(let i=0; i<s.trails.length; i++){
            const t = s.trails[i];
            ctx.fillStyle = `rgba(${s.shield ? '0,255,255' : (s.weaponType === 'toxic' ? '163,230,53' : colors.primary)}, ${t.life * 0.4})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, (t.size / 2) * t.life, 0, Math.PI * 2);
            ctx.fill();
        }

        for(let i=0; i<s.bullets.length; i++){
            const b = s.bullets[i];
            ctx.fillStyle = b.color || '#fff';
            if (b.type === 'toxic') {
                ctx.shadowBlur = 15;
                ctx.shadowColor = b.color || '#fff';
                ctx.fillRect(b.x, b.y, b.size, 120);
                ctx.shadowBlur = 0;
            } else {
                ctx.beginPath();
                ctx.arc(b.x + b.size / 2, b.y + b.size / 2, b.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        for(let i=0; i<s.enemies.length; i++){
            const e = s.enemies[i];
            ctx.fillStyle = e.color;
            if (e.isStick) ctx.fillRect(e.x, e.y, e.w || 4, e.h || 50);
            else ctx.fillRect(e.x, e.y, e.size, e.size);
        }

        for(let i=0; i<s.powerups.length; i++){
            const p = s.powerups[i];
            let pColor = '#fff';
            switch (p.type) {
                case 'dual': pColor = '#ff00ff'; break;
                case 'rapid': pColor = '#00ffff'; break;
                case 'split': pColor = '#00ffaa'; break;
                case 'big': pColor = '#ffaa00'; break;
                case 'shield': pColor = '#0088ff'; break;
                case 'point': pColor = '#ffff00'; break;
                case 'toxic': pColor = '#a3e635'; break;
            }
            ctx.fillStyle = pColor;
            ctx.beginPath();
            ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.size / 4, 0, Math.PI * 2);
            ctx.fill();
        }

        const playerColor = s.weaponType === 'toxic' ? '#a3e635' : (s.weaponType !== 'standard' ? '#fff' : (s.shield ? '#00ffff' : colors.primary));
        ctx.fillStyle = s.invincible ? `rgba(255,255,255,${Math.random()})` : playerColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = playerColor;
        drawPlayerArrow(ctx, s.player.x, s.player.y, s.player.size, s.weaponType === 'dual');
        ctx.shadowBlur = 0;

        for (const b of s.bosses) {
            ctx.save();
            if (b.isDying && Math.random() > 0.5) ctx.translate(Math.random() * 6 - 3, Math.random() * 6 - 3);
            const isFrozen = s.isBlockRainActive;
            const isAngry = b.health < b.maxHealth * 0.2;
            ctx.fillStyle = b.hit ? '#fff' : (isFrozen ? '#555' : (isAngry ? '#ff00ff' : b.color));
            ctx.shadowBlur = isFrozen ? 10 : (isAngry ? 40 : 25);
            ctx.shadowColor = isFrozen ? '#ccc' : (isAngry ? '#ff00ff' : b.color);
            ctx.fillRect(b.x, b.y, b.size, b.size);
            drawBossFace(ctx, b, b.x, b.y, b.size);
            
            if (!b.isDying) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#111';
                ctx.fillRect(b.x, b.y - 35, b.size, 14);
                ctx.fillStyle = isFrozen ? '#888' : (isAngry ? '#ff00ff' : '#0f0');
                ctx.fillRect(b.x, b.y - 35, (b.size / b.maxHealth) * b.health, 14);
            } else {
                const phrases = getTranslation('bossDyingPhrases', language).split('|');
                const progress = (3.0 - b.deathTimer) / 3.0;
                const phraseIdx = Math.floor(progress * phrases.length);
                const currentPhrase = phrases[Math.min(phraseIdx, phrases.length - 1)];
                
                ctx.save();
                ctx.font = '900 12px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#fff';
                const dialogY = b.y - 40 + Math.sin(Date.now() / 100) * 5;
                ctx.fillText(currentPhrase, b.x + b.size / 2, dialogY);
                for(let p=0; p<3; p++) {
                    ctx.fillStyle = Math.random() > 0.5 ? '#fff' : b.color;
                    ctx.fillRect(b.x + Math.random() * b.size, b.y + Math.random() * b.size, 4, 4);
                }
                ctx.restore();
            }

            if (b.hasFakedDeath && !b.isDying && b.health > b.maxHealth * 0.45) {
                ctx.save();
                ctx.font = '900 10px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#f0f';
                ctx.fillText(getTranslation('bossFakeDeathReturn', language), b.x + b.size/2, b.y - 50);
                ctx.restore();
            }
            ctx.restore();
        }

        if (s.flashEffect > 0) {
            ctx.fillStyle = `rgba(255,255,255,${s.flashEffect})`;
            ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();

        if ([GameState.PLAYING, GameState.BOSS_WARNING, GameState.COUNTDOWN].includes(gameState)) {
            ctx.fillStyle = currentLevel === 1000 ? '#ff0000' : '#fff';
            ctx.font = '900 18px Orbitron';
            ctx.textAlign = 'left';
            ctx.fillText(`${getTranslation('phase', language)} ${currentLevel}`, 30, 45);
            if (s.weaponTimer > 0 && s.weaponType !== 'toxic') {
                ctx.fillStyle = s.weaponType === 'rapid' ? '#0ff' : '#f0f';
                ctx.fillRect(30, 60, (s.weaponTimer / (currentLevel === 1000 ? 12 : 7.5)) * 100, 4);
            } else if (s.weaponType === 'toxic') {
                ctx.fillStyle = '#a3e635';
                ctx.font = '900 10px Orbitron';
                ctx.fillText('TOXIC LOADED', 30, 65);
            }
            ctx.textAlign = 'right';
            const ptBoss = Math.min(400, 60 + (currentLevel * 4));
            let progText = trainingMode ? 'MODO BOSS' : (s.bosses.length > 0 ? 'ENGAGED' : `${s.levelScore}/${ptBoss}`);
            if (s.isBlockRainActive) progText = `RAIN: ${Math.ceil(s.blockRainTimer)}s`;
            ctx.fillText(progText, width - 30, 45);
        }
    };

    const drawBossFace = (ctx: CanvasRenderingContext2D, b: Boss, x: number, y: number, size: number) => {
        const s = stateRef.current;
        const eyeSize = size * 0.15;
        const eyeOff = size * 0.25;
        const isP2 = b.health < b.maxHealth * 0.5;
        const isAngry = b.health < b.maxHealth * 0.2;
        const isDying = b.isDying;
        const isFrozen = !isDying && s.isBlockRainActive;
        
        ctx.fillStyle = isDying ? '#550000' : (isFrozen ? '#ccc' : (isAngry ? '#ff00ff' : (isP2 ? '#ff0000' : '#ffffff')));
        
        ctx.beginPath();
        if (isDying) {
            ctx.moveTo(x + eyeOff - eyeSize, y + size * 0.35 - eyeSize);
            ctx.lineTo(x + eyeOff + eyeSize, y + size * 0.35 + eyeSize);
            ctx.moveTo(x + eyeOff + eyeSize, y + size * 0.35 - eyeSize);
            ctx.lineTo(x + eyeOff - eyeSize, y + size * 0.35 + eyeSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.arc(x + eyeOff, y + size * 0.35, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.beginPath();
        if (isDying) {
            ctx.moveTo(x + size - eyeOff - eyeSize, y + size * 0.35 - eyeSize);
            ctx.lineTo(x + size - eyeOff + eyeSize, y + size * 0.35 + eyeSize);
            ctx.moveTo(x + size - eyeOff + eyeSize, y + size * 0.35 - eyeSize);
            ctx.lineTo(x + size - eyeOff - eyeSize, y + size * 0.35 + eyeSize);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.arc(x + size - eyeOff, y + size * 0.35, eyeSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = isDying ? '#fff' : ctx.fillStyle as string;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (isDying) ctx.arc(x + size / 2, y + size * 0.7, size * 0.1, 0, Math.PI * 2);
        else if (isAngry || isP2 || isFrozen) {
            ctx.moveTo(x + eyeOff, y + size * 0.7);
            ctx.lineTo(x + size / 2, y + size * 0.85);
            ctx.lineTo(x + size - eyeOff, y + size * 0.7);
        }
        else ctx.arc(x + size / 2, y + size * 0.55, size * 0.25, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
    };

    const drawPlayerArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, isDual: boolean) => {
        ctx.beginPath();
        if (isDual) {
            ctx.moveTo(x + size / 4, y);
            ctx.lineTo(x - size / 4, y + size);
            ctx.lineTo(x + size / 4, y + size * 0.8);
            ctx.lineTo(x + size / 2, y + size);
            ctx.lineTo(x + size / 2, y);
            ctx.moveTo(x + size / 2, y);
            ctx.lineTo(x + size * 0.5, y + size);
            ctx.lineTo(x + size * 0.75, y + size * 0.8);
            ctx.lineTo(x + size * 1.25, y + size);
            ctx.lineTo(x + size * 0.75, y);
        } else {
            ctx.moveTo(x + size / 2, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x + size / 2, y + size * 0.75);
            ctx.lineTo(x + size, y + size);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false }); // Optmization: opaque canvas
        if (!ctx) return;

        const updateSize = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            dimensionsRef.current = { width: rect.width, height: rect.height };
            initStars(rect.width, rect.height);
        };

        updateSize();
        window.addEventListener('resize', updateSize);

        let rafId: number;
        const loop = (timestamp: number) => {
            const dt = Math.min(0.1, (timestamp - lastTimeRef.current) / 1000);
            lastTimeRef.current = timestamp;

            update(dt);
            draw(ctx);
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updateSize);
        };
    }, [gameState, theme, currentLevel, language, trainingMode]);

    return <canvas ref={canvasRef} className="bg-black block w-full h-full touch-none" />;
};

export default GameCanvas;
