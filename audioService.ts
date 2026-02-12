
export class AudioService {
    private ctx: AudioContext | null = null;
    private bgMusic: HTMLAudioElement | null = null;

    private init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private createOscillator(freq: number, type: OscillatorType, duration: number, volume = 0.1) {
        this.init();
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playStart() {
        this.createOscillator(440, 'square', 0.5, 0.1);
        setTimeout(() => this.createOscillator(880, 'square', 0.5, 0.1), 100);
    }

    playCollect() {
        this.createOscillator(1200, 'sine', 0.1, 0.05);
        setTimeout(() => this.createOscillator(1600, 'sine', 0.1, 0.05), 50);
    }

    playShieldLost() {
        this.createOscillator(200, 'sawtooth', 0.4, 0.15);
    }

    playShoot() {
        this.createOscillator(800, 'triangle', 0.05, 0.05);
    }

    playBossHit() {
        this.createOscillator(150, 'square', 0.1, 0.1);
    }

    playExplosion() {
        this.init();
        if (!this.ctx) return;
        const duration = 0.8;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playBossExplosion() {
        this.init();
        if (!this.ctx) return;
        const duration = 2.0;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(60, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(5, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
        setTimeout(() => {
            this.createOscillator(40, 'sawtooth', 0.5, 0.2);
        }, 100);
    }

    playCountdown(count: number) {
        this.createOscillator(count === 0 ? 800 : 400, 'sine', 0.1, 0.1);
    }

    // --- Background Music Logic ---
    
    playCustomMusic(url: string) {
        this.stopBgMusic();
        this.bgMusic = new Audio(url);
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;
        this.bgMusic.play().catch(e => console.log("Erro ao tocar música:", e));
    }

    stopBgMusic() {
        if (this.bgMusic) {
            this.bgMusic.pause();
            this.bgMusic.currentTime = 0;
            this.bgMusic = null;
        }
    }
}

export const audio = new AudioService();
