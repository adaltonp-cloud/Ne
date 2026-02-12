
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, SaveData, ThemeType } from './types';
import { SaveService } from './services/saveService';
import { audio } from './services/audioService';
import { getTranslation } from './constants';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
    const [saveData, setSaveData] = useState<SaveData>(SaveService.load());
    const [countdown, setCountdown] = useState(3);
    const [currentLevel, setCurrentLevel] = useState(1);
    const [levelScore, setLevelScore] = useState(0);
    const [pendingLevel, setPendingLevel] = useState<number | null>(null);
    const [isTraining, setIsTraining] = useState(false);
    const [bgOffset, setBgOffset] = useState(0);
    const [viewPolicy, setViewPolicy] = useState(false);
    
    // Custom Music State
    const [customMusicName, setCustomMusicName] = useState<string | null>(null);
    const musicInputRef = useRef<HTMLInputElement>(null);

    // Dev Mode Password State
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const [passwordValue, setPasswordValue] = useState('');

    useEffect(() => {
        const interval = setInterval(() => setBgOffset(prev => (prev + 1) % 40), 50);
        if (gameState === GameState.INTRO) {
            setTimeout(() => setGameState(GameState.MENU), 3000);
        }
        return () => clearInterval(interval);
    }, [gameState]);

    const handleStartLevel = useCallback((level: number, training = false) => {
        setIsTraining(training);
        if (!saveData.tutorialSeen) {
            setPendingLevel(level);
            setGameState(GameState.TUTORIAL);
            return;
        }
        setCurrentLevel(level);
        setLevelScore(0);
        setGameState(GameState.COUNTDOWN);
        let count = 3;
        setCountdown(count);
        audio.playCountdown(count);
        const interval = setInterval(() => {
            count--;
            setCountdown(count);
            if (count >= 0) audio.playCountdown(count);
            if (count < 0) {
                clearInterval(interval);
                setGameState(GameState.PLAYING);
                audio.playStart();
            }
        }, 1000);
    }, [saveData.tutorialSeen]);

    const handleLevelComplete = useCallback((level: number) => {
        if (isTraining) {
            setGameState(GameState.VICTORY);
            audio.playStart();
            return;
        }
        const nextLevel = level + 1;
        const newMax = Math.max(saveData.maxLevel, nextLevel);
        SaveService.save({ maxLevel: newMax });
        setSaveData(prev => ({ ...prev, maxLevel: newMax }));
        setGameState(GameState.VICTORY);
        audio.playStart();
    }, [saveData.maxLevel, isTraining]);

    const handleGameOver = useCallback((finalScore: number) => {
        const newHighScore = Math.max(saveData.highScore, finalScore);
        SaveService.save({ highScore: newHighScore });
        setSaveData(prev => ({ ...prev, highScore: newHighScore }));
        setGameState(GameState.GAME_OVER);
        audio.playExplosion();
    }, [saveData.highScore]);

    const changeTheme = (theme: ThemeType) => {
        SaveService.save({ theme });
        setSaveData(prev => ({ ...prev, theme }));
        audio.playCollect();
    };

    const setLang = (l: string) => {
        SaveService.save({ language: l });
        setSaveData(prev => ({ ...prev, language: l }));
        audio.playCollect();
    };

    const handleMusicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCustomMusicName(file.name);
            const url = URL.createObjectURL(file);
            audio.playCustomMusic(url);
        }
    };

    const handleClearMusic = () => {
        audio.stopBgMusic();
        setCustomMusicName(null);
        if (musicInputRef.current) musicInputRef.current.value = '';
    };

    const getSkinColor = (theme: ThemeType) => {
        switch (theme) {
            case 'supernova': return '#f97316';
            case 'abismo': return '#22c55e';
            case 'vortex': return '#ec4899';
            case 'estelar': return '#eab308';
            default: return '#06b6d4';
        }
    };

    const handleCheckPassword = () => {
        if (passwordValue.toLowerCase() === 'bonzin') {
            setGameState(GameState.LEVEL_TEST);
            setShowPasswordInput(false);
            setPasswordValue('');
            audio.playCollect();
        } else {
            audio.playShieldLost();
            setPasswordValue('');
        }
    };

    const t = (key: string) => getTranslation(key, saveData.language);

    return (
        <div className="relative w-screen h-screen bg-[#020202] flex items-center justify-center overflow-hidden select-none touch-none font-['Orbitron'] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 pointer-events-none opacity-10" 
                 style={{ 
                    backgroundImage: `linear-gradient(rgba(0,212,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.1) 1px, transparent 1px)`, 
                    backgroundSize: '50px 50px', 
                    transform: `translateY(${bgOffset}px)` 
                 }} />

            {/* Main Container */}
            <div className="relative border-y-2 border-white/20 shadow-[0_0_120px_rgba(0,0,0,1)] bg-black w-full h-[97vh] transition-all overflow-hidden sm:rounded-lg">
                <GameCanvas 
                    gameState={gameState} 
                    currentLevel={currentLevel} 
                    theme={saveData.theme} 
                    language={saveData.language} 
                    trainingMode={isTraining} 
                    onGameOver={handleGameOver} 
                    onScoreUpdate={setLevelScore} 
                    onLevelComplete={handleLevelComplete} 
                    onBossWarning={() => setGameState(GameState.BOSS_WARNING)} 
                    onBossSpawned={() => setGameState(GameState.PLAYING)} 
                    onBossEncountered={(lv) => { 
                        if (lv > saveData.maxBossUnlocked) { 
                            SaveService.save({ maxBossUnlocked: lv }); 
                            setSaveData(p => ({...p, maxBossUnlocked: lv})); 
                        } 
                    }} 
                />

                {/* UI OVERLAYS */}
                
                {gameState === GameState.INTRO && (
                    <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center text-center animate-fade-in">
                        <div className="relative mb-4">
                            <h1 className="text-5xl font-black text-cyan-400 italic tracking-tighter animate-pulse">NEON DASH</h1>
                            <div className="absolute -inset-1 bg-cyan-400/20 blur-xl animate-pulse" />
                        </div>
                        <p className="text-gray-500 text-[10px] tracking-[0.4em] uppercase font-bold">{t('createdBy')}</p>
                    </div>
                )}

                {gameState === GameState.MENU && (
                    <div className="absolute inset-0 z-50 bg-black/70 flex flex-col items-center justify-center p-8 text-center backdrop-blur-[6px] animate-fade-in overflow-y-auto custom-scrollbar">
                        <div className="mb-10 relative group shrink-0">
                            <h1 className="text-7xl font-black text-cyan-400 italic tracking-tighter">NEON</h1>
                            <h1 className="text-7xl font-black text-white italic tracking-tighter -mt-4">DASH</h1>
                            <div className="absolute -top-6 -right-6 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-bold animate-pulse">ULTIMATE</div>
                        </div>
                        <div className="w-full max-w-md flex flex-col gap-3">
                            <button onClick={() => setGameState(GameState.LEVEL_SELECT)} className="w-full py-5 bg-cyan-500 text-black font-black text-xl rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.4)] active:scale-95 transition-all uppercase">{t('play')}</button>
                            <button onClick={() => setGameState(GameState.BOSS_TRAINING_SELECT)} className="w-full py-4 border-2 border-red-500/50 text-red-400 font-black text-lg rounded-2xl bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)] uppercase">{t('bossMode')}</button>
                            <button onClick={() => setGameState(GameState.SKINS)} className="w-full py-3 border-2 border-cyan-500/50 text-cyan-400 font-bold rounded-xl bg-cyan-500/10 uppercase">{t('skins')}</button>
                            <button onClick={() => setGameState(GameState.SETTINGS)} className="w-full py-3 border-2 border-white/20 text-white font-bold rounded-xl bg-white/5 uppercase">{t('settings')}</button>
                            
                            <div className="grid grid-cols-2 gap-4 w-full text-[10px] uppercase tracking-widest mt-4 shrink-0">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-inner">
                                    <p className="text-gray-500">{t('record')}</p>
                                    <p className="text-yellow-500 font-bold text-xl">{saveData.highScore}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 shadow-inner">
                                    <p className="text-gray-500">{t('maxLevel')}</p>
                                    <p className="text-white font-bold text-xl">{saveData.maxLevel}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === GameState.SETTINGS && (
                    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-6 animate-slide-bottom backdrop-blur-2xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4 shrink-0">
                            <h2 className="text-xl font-black text-white italic">{viewPolicy ? t('privacyPolicy') : t('settings')}</h2>
                            <button onClick={() => { if(viewPolicy) setViewPolicy(false); else setGameState(GameState.MENU); }} className="text-white text-[10px] bg-white/10 px-5 py-2 rounded-full font-black uppercase tracking-widest">{t('back')}</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2 pb-6 max-w-lg mx-auto w-full">
                            {viewPolicy ? (
                                <div className="animate-fade-in space-y-6">
                                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                                        <p className="text-white/80 text-sm leading-relaxed text-justify">
                                            {t('policyContent')}
                                        </p>
                                        <div className="pt-4 border-t border-white/10">
                                            <p className="text-cyan-400 font-black text-xs uppercase tracking-widest">
                                                {t('developedBy')}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setViewPolicy(false)} className="w-full py-4 bg-white/10 border border-white/20 text-white font-black rounded-xl uppercase text-xs">
                                        {t('back')}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <button onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }} className="w-full py-5 bg-white/10 border-2 border-white/20 text-white font-black text-sm rounded-2xl">{t('fullScreen')}</button>
                                    
                                    {/* MÚSICA PERSONALIZADA */}
                                    <div className="space-y-3 p-5 bg-white/5 border border-white/10 rounded-2xl">
                                        <p className="text-[11px] text-cyan-400 font-black uppercase tracking-widest mb-1">{t('customMusic')}</p>
                                        <div className="flex flex-col gap-3">
                                            <input 
                                                type="file" 
                                                accept="audio/mpeg, audio/mp3" 
                                                className="hidden" 
                                                ref={musicInputRef}
                                                onChange={handleMusicUpload} 
                                            />
                                            <button 
                                                onClick={() => musicInputRef.current?.click()}
                                                className="w-full py-4 bg-cyan-500/10 border-2 border-cyan-500/30 text-cyan-400 font-black text-xs rounded-xl flex items-center justify-center gap-2"
                                            >
                                                <span>{t('selectMusic')}</span>
                                            </button>
                                            
                                            {customMusicName && (
                                                <div className="flex flex-col gap-2 animate-fade-in">
                                                    <div className="flex items-center gap-2 text-white/50 text-[10px] bg-black/30 p-3 rounded-lg border border-white/5">
                                                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                                        <span className="truncate flex-1">{customMusicName}</span>
                                                    </div>
                                                    <button 
                                                        onClick={handleClearMusic}
                                                        className="w-full py-2 text-red-400 font-bold text-[9px] uppercase tracking-widest border border-red-400/20 rounded-lg hover:bg-red-400/5"
                                                    >
                                                        {t('clearMusic')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* MODO TESTE BUTTON WITH PASSWORD */}
                                    <div className="space-y-3">
                                        {!showPasswordInput ? (
                                            <button onClick={() => setShowPasswordInput(true)} className="w-full py-4 bg-yellow-500/10 border-2 border-yellow-500/40 text-yellow-500 font-black text-xs rounded-2xl flex flex-col items-center justify-center">
                                                <span>{t('levelTest')}</span>
                                                <span className="text-[8px] opacity-60 mt-1">{t('debugInfo')}</span>
                                            </button>
                                        ) : (
                                            <div className="bg-white/5 p-4 rounded-2xl border-2 border-yellow-500/20 space-y-3 animate-fade-in">
                                                <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-widest text-center">{t('enterPassword')}</p>
                                                <input 
                                                    type="password" 
                                                    value={passwordValue}
                                                    onChange={(e) => setPasswordValue(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCheckPassword()}
                                                    className="w-full bg-black/50 border border-white/20 rounded-xl py-3 px-4 text-white text-center font-black focus:outline-none focus:border-yellow-500 transition-all"
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <button onClick={() => setShowPasswordInput(false)} className="flex-1 py-2 bg-white/5 text-gray-400 font-bold text-[10px] rounded-lg border border-white/10">{t('back')}</button>
                                                    <button onClick={handleCheckPassword} className="flex-[2] py-2 bg-yellow-500 text-black font-black text-[10px] rounded-lg">{t('unlock')}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-[11px] text-gray-500 font-black uppercase tracking-widest">{t('language')}</p>
                                        {['pt_BR', 'en_US', 'es_ES'].map(l => (
                                            <button key={l} onClick={() => setLang(l)} className={`w-full py-4 px-6 rounded-2xl border-2 text-left font-black transition-all ${saveData.language === l ? 'border-cyan-400 bg-cyan-400/10 text-white' : 'border-white/5 bg-white/5 text-gray-600'}`}>
                                                {l.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t border-white/10">
                                        <button onClick={() => setViewPolicy(true)} className="w-full py-4 text-gray-400 font-bold uppercase text-[10px] tracking-widest bg-white/5 rounded-xl border border-white/5 active:scale-95 transition-all">
                                            {t('privacyPolicy')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {gameState === GameState.LEVEL_SELECT && (
                    <div className="absolute inset-0 z-50 bg-black flex flex-col p-6 animate-slide-right">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h2 className="text-xl font-black text-cyan-400 italic">{t('missions')}</h2>
                            <button onClick={() => setGameState(GameState.MENU)} className="text-white text-[10px] bg-white/10 px-4 py-2 rounded-full font-black uppercase">{t('back')}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-5 md:grid-cols-10 gap-3 pb-8 pr-2 custom-scrollbar">
                            {Array.from({ length: 1000 }, (_, i) => i + 1).map(lv => (
                                <button key={lv} 
                                        disabled={lv > saveData.maxLevel} 
                                        onClick={() => handleStartLevel(lv)} 
                                        className={`aspect-square flex items-center justify-center font-black text-[10px] rounded-lg transition-all border ${lv <= saveData.maxLevel ? (lv % 10 === 0 ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-cyan-500/10 text-cyan-400 border-cyan-400/30 active:scale-90') : 'bg-gray-900 text-gray-800 opacity-30 border-white/5'}`}>
                                    {lv}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* LEVEL TEST SCREEN */}
                {gameState === GameState.LEVEL_TEST && (
                    <div className="absolute inset-0 z-50 bg-black flex flex-col p-6 animate-slide-right">
                        <div className="flex justify-between items-center mb-6 border-b border-yellow-500/20 pb-4">
                            <div className="flex flex-col text-left">
                                <h2 className="text-xl font-black text-yellow-500 italic uppercase leading-tight">DEBUG SECTOR</h2>
                                <span className="text-[8px] text-gray-500 uppercase tracking-widest">BOSS ONLY TEST</span>
                            </div>
                            <button onClick={() => setGameState(GameState.SETTINGS)} className="text-white text-[10px] bg-white/10 px-4 py-2 rounded-full font-black uppercase">{t('back')}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-5 md:grid-cols-10 gap-3 pb-8 pr-2 custom-scrollbar">
                            {Array.from({ length: 1000 }, (_, i) => i + 1).map(lv => (
                                <button key={lv} 
                                        onClick={() => handleStartLevel(lv, true)} 
                                        className={`aspect-square flex items-center justify-center font-black text-[10px] rounded-lg transition-all border bg-yellow-500/5 text-yellow-500 border-yellow-500/20 active:scale-90 active:bg-yellow-500/20`}>
                                    {lv}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === GameState.BOSS_TRAINING_SELECT && (
                    <div className="absolute inset-0 z-50 bg-black flex flex-col p-6 animate-slide-right">
                        <div className="flex justify-between items-center mb-6 border-b border-red-500/20 pb-4">
                            <h2 className="text-xl font-black text-red-500 italic">{t('bossTraining')}</h2>
                            <button onClick={() => setGameState(GameState.MENU)} className="text-white text-[10px] bg-white/10 px-4 py-2 rounded-full font-black uppercase">{t('back')}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto grid grid-cols-5 md:grid-cols-10 gap-3 pb-8 pr-2 custom-scrollbar">
                            {Array.from({ length: 1000 }, (_, i) => i + 1).map(lv => (
                                <button key={lv} 
                                        disabled={lv > saveData.maxBossUnlocked} 
                                        onClick={() => handleStartLevel(lv, true)} 
                                        className={`aspect-square flex items-center justify-center font-black text-[10px] rounded-lg transition-all border ${lv <= saveData.maxBossUnlocked ? 'bg-red-500/20 text-red-400 border-red-500/40 active:scale-90' : 'bg-gray-900 text-gray-800 opacity-20 border-white/5'}`}>
                                    {lv}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === GameState.SKINS && (
                    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col p-6 animate-slide-bottom backdrop-blur-xl">
                        <div className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
                            <h2 className="text-xl font-black text-cyan-400 italic">{t('garage')}</h2>
                            <button onClick={() => setGameState(GameState.MENU)} className="text-white text-[10px] bg-white/10 px-5 py-2 rounded-full font-black uppercase">{t('close')}</button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar max-w-lg mx-auto w-full">
                            {(['nebulosa', 'supernova', 'abismo', 'vortex', 'estelar'] as ThemeType[]).map(s => (
                                <button key={s} onClick={() => changeTheme(s)} className={`w-full flex items-center p-6 rounded-3xl border-2 transition-all ${saveData.theme === s ? 'border-cyan-400 bg-cyan-400/20' : 'border-white/5 bg-white/5'}`}>
                                    <div className="w-14 h-14 rounded-full border-4 border-white/20 animate-pulse" 
                                         style={{ backgroundColor: getSkinColor(s), boxShadow: `0 0 25px ${getSkinColor(s)}` }} />
                                    <div className="flex-1 text-left ml-6">
                                        <p className={`font-black text-lg ${saveData.theme === s ? 'text-white' : 'text-gray-400'}`}>{s.toUpperCase()}</p>
                                        <p className="text-[10px] text-gray-600">NEURAL CORE ACTIVE</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {gameState === GameState.GAME_OVER && (
                    <div className="absolute inset-0 z-50 bg-red-950/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-lg animate-fade-in">
                        <h2 className="text-6xl font-black text-white italic drop-shadow-[0_0_30px_red] uppercase mb-2">{t('gameOver')}</h2>
                        <p className="text-red-400 text-[10px] uppercase font-black">{t('systemCorrupted')}</p>
                        <div className="mt-16 flex flex-col gap-4 w-full max-w-[320px]">
                            <button onClick={() => handleStartLevel(currentLevel, isTraining)} className="py-6 bg-white text-red-950 font-black rounded-2xl text-xl uppercase">{t('retry')}</button>
                            <button onClick={() => setGameState(isTraining ? GameState.BOSS_TRAINING_SELECT : GameState.MENU)} className="py-4 border-2 border-white/20 text-white font-black rounded-2xl bg-white/5 uppercase text-xs">{t('mainMenu')}</button>
                        </div>
                    </div>
                )}

                {gameState === GameState.VICTORY && (
                    <div className="absolute inset-0 z-50 bg-cyan-950/90 flex flex-col items-center justify-center p-8 backdrop-blur-xl animate-zoom-in">
                        <h2 className="text-7xl font-black text-white italic drop-shadow-[0_0_40px_cyan] uppercase mb-2">{t('victory')}</h2>
                        <p className="text-cyan-400 font-black text-sm uppercase">{t('sectorRestored')} {currentLevel}</p>
                        <div className="mt-16 w-full flex flex-col gap-4 max-w-[320px]">
                            {!isTraining ? (
                                <button onClick={() => handleStartLevel(currentLevel + 1)} className="py-6 bg-cyan-400 text-cyan-950 font-black rounded-3xl text-2xl uppercase">{t('nextMission')}</button>
                            ) : (
                                <button onClick={() => setGameState(GameState.BOSS_TRAINING_SELECT)} className="py-6 bg-red-600 text-white font-black rounded-3xl text-2xl uppercase">{t('back')}</button>
                            )}
                            <button onClick={() => setGameState(GameState.MENU)} className="py-4 border-2 border-white/20 text-white font-black rounded-2xl bg-white/5 uppercase text-xs">{t('mainMenu')}</button>
                        </div>
                    </div>
                )}

                {gameState === GameState.COUNTDOWN && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                        <span className="text-[180px] font-black text-white italic animate-ping opacity-80">{countdown > 0 ? countdown : '!'}</span>
                    </div>
                )}

                {gameState === GameState.BOSS_WARNING && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
                        <div className="bg-red-600/90 w-full py-10 -skew-y-2 shadow-[0_0_80px_red] flex items-center justify-center border-y-4 border-white animate-zoom-in">
                            <h2 className="text-6xl font-black italic text-white animate-pulse">{t('bossDetected')}</h2>
                        </div>
                    </div>
                )}
                
                {gameState === GameState.TUTORIAL && (
                    <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center p-8 text-center backdrop-blur-xl animate-zoom-in">
                        <div className="w-full max-w-xs border-2 border-cyan-500/30 rounded-3xl p-8 bg-white/5 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                            <h2 className="text-2xl font-black text-cyan-400 mb-6 italic">{t('tutorialTitle')}</h2>
                            <p className="text-white/80 text-sm leading-relaxed mb-10">{t('tutorialBody')}</p>
                            <button onClick={() => { 
                                SaveService.save({ tutorialSeen: true }); 
                                setSaveData(p => ({...p, tutorialSeen: true})); 
                                if (pendingLevel) handleStartLevel(pendingLevel, isTraining); else setGameState(GameState.MENU); 
                            }} className="w-full py-4 bg-cyan-50 text-black font-black text-lg rounded-2xl uppercase">{t('continue')}</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
