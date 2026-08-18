/**
 * ============================================================================
 * HIGHWAY TRAFFIC RACER - COMPLETE GAME ENGINE
 * Top-down / Pseudo-3D Arcade Highway Racing Game
 * Built with HTML5 Canvas, Web Audio API & Vanilla JavaScript
 * ============================================================================
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. STORAGE & CONFIGURATION
     ========================================================================== */

  const Storage = {
    KEY: 'highway_racer_save_v1',
    data: {
      bestScore: 0,
      bestDistance: 0,
      coins: 200,
      unlockedCars: [0],
      selectedCar: 0,
      selectedEnv: 0,
      settings: {
        sound: true,
        music: true,
        shake: true,
        sensitivity: 1.0
      }
    },
    init() {
      try {
        const raw = localStorage.getItem(this.KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = { ...this.data, ...parsed, settings: { ...this.data.settings, ...(parsed.settings || {}) } };
        }
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      this.save();
    },
    save() {
      try {
        localStorage.setItem(this.KEY, JSON.stringify(this.data));
      } catch (e) {
        console.warn('Failed to save to LocalStorage:', e);
      }
    }
  };

  /* ==========================================================================
     2. PROCEDURAL WEB AUDIO SYNTHESIZER
     ========================================================================== */

  const Audio = {
    ctx: null,
    musicOscs: [],
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    nitroOsc: null,
    nitroGain: null,
    musicTimer: null,
    musicStep: 0,
    initialized: false,

    init() {
      if (this.initialized) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.initialized = true;
      } catch (e) {
        console.warn('Web Audio API not supported', e);
      }
    },

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    // Engine rumble sound
    startEngine() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      this.stopEngine();
      try {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(140, this.ctx.currentTime);

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
      } catch (e) {}
    },

    updateEngine(speedRatio) {
      if (!this.engineOsc || !this.ctx || !Storage.data.settings.sound) return;
      try {
        const targetFreq = 40 + speedRatio * 95;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
      } catch (e) {}
    },

    stopEngine() {
      if (this.engineOsc) {
        try {
          this.engineOsc.stop();
          this.engineOsc.disconnect();
        } catch (e) {}
        this.engineOsc = null;
      }
    },

    // Nitro sound
    startNitro() {
      if (!this.ctx || !Storage.data.settings.sound || this.nitroOsc) return;
      try {
        // Noise buffer for roar
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);
        filter.Q.setValueAtTime(3, this.ctx.currentTime);

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

        noise.connect(filter);
        filter.connect(this.nitroGain);
        this.nitroGain.connect(this.ctx.destination);
        noise.start();
        this.nitroOsc = noise;
      } catch (e) {}
    },

    stopNitro() {
      if (this.nitroOsc) {
        try {
          this.nitroOsc.stop();
          this.nitroOsc.disconnect();
        } catch (e) {}
        this.nitroOsc = null;
      }
    },

    // Procedural SFX helpers
    playCoin() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, t); // B5
        osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.08); // E6
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.22);
      } catch (e) {}
    },

    playPowerup() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const t = this.ctx.currentTime + idx * 0.06;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.15, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(t);
          osc.stop(t + 0.15);
        });
      } catch (e) {}
    },

    playOvertake() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, t); // D5
        osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      } catch (e) {}
    },

    playCloseCall() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(220, t);
        osc1.frequency.exponentialRampToValueAtTime(660, t + 0.2);
        osc2.frequency.setValueAtTime(440, t);
        osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.2);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.28);
        osc2.stop(t + 0.28);
      } catch (e) {}
    },

    playCrash() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        // White noise crunch
        const bufferSize = this.ctx.sampleRate * 0.6;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.15));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(t);

        // Low boom
        const boom = this.ctx.createOscillator();
        const boomGain = this.ctx.createGain();
        boom.type = 'sine';
        boom.frequency.setValueAtTime(120, t);
        boom.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        boomGain.gain.setValueAtTime(0.5, t);
        boomGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        boom.connect(boomGain);
        boomGain.connect(this.ctx.destination);
        boom.start(t);
        boom.stop(t + 0.5);
      } catch (e) {}
    },

    playShieldDeflect() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(900, t + 0.15);
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      } catch (e) {}
    },

    playClick() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.04);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.04);
      } catch (e) {}
    },

    playBrake() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.18);
      } catch (e) {}
    },

    playIntroRev() {
      if (!this.ctx || !Storage.data.settings.sound) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(45, t);
        osc.frequency.exponentialRampToValueAtTime(160, t + 0.35);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.7);
        osc.frequency.exponentialRampToValueAtTime(220, t + 1.1);
        osc.frequency.exponentialRampToValueAtTime(50, t + 1.6);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(250, t);
        filter.frequency.exponentialRampToValueAtTime(900, t + 0.4);
        filter.frequency.exponentialRampToValueAtTime(300, t + 1.6);

        gain.gain.setValueAtTime(0.01, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 1.6);
      } catch (e) {}
    },

    // Synthwave Arpeggiated Background Music
    startMusic() {
      if (!this.ctx || !Storage.data.settings.music || this.musicTimer) return;
      this.musicStep = 0;
      const bassline = [110, 110, 130.81, 130.81, 98, 98, 123.47, 123.47]; // A2, C3, G2, B2
      const melody = [440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88];

      this.musicTimer = setInterval(() => {
        if (!Storage.data.settings.music || !this.ctx) return;
        try {
          const t = this.ctx.currentTime;
          const bassFreq = bassline[this.musicStep % bassline.length];
          const melFreq = melody[this.musicStep % melody.length];

          // Bass synth
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bassOsc.type = 'sawtooth';
          bassOsc.frequency.setValueAtTime(bassFreq, t);
          bassGain.gain.setValueAtTime(0.04, t);
          bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          bassOsc.connect(bassGain);
          bassGain.connect(this.ctx.destination);
          bassOsc.start(t);
          bassOsc.stop(t + 0.18);

          // Lead synth
          const leadOsc = this.ctx.createOscillator();
          const leadGain = this.ctx.createGain();
          leadOsc.type = 'triangle';
          leadOsc.frequency.setValueAtTime(melFreq, t);
          leadGain.gain.setValueAtTime(0.025, t);
          leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          leadOsc.connect(leadGain);
          leadGain.connect(this.ctx.destination);
          leadOsc.start(t);
          leadOsc.stop(t + 0.15);

          this.musicStep++;
        } catch (e) {}
      }, 150);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    }
  };

  /* ==========================================================================
     3. CAR DEFINITIONS & GARAGE DATA
     ========================================================================== */

  const CARS = [
    {
      id: 'starter',
      name: 'STREET RUNNER',
      tagline: 'Balanced All-Rounder',
      price: 0,
      stats: { speed: 65, accel: 65, handling: 70, nitro: 60 },
      width: 48,
      height: 92,
      primaryColor: '#e11d48',
      stripeColor: '#ffffff',
      windowColor: '#0f172a',
      roofColor: '#be123c',
      glowColor: '#ff2a4b',
      spoiler: true,
      maxSpeed: 175,
      accelRate: 35,
      handlingRate: 5.2,
      nitroPower: 65
    },
    {
      id: 'coupe',
      name: 'NEON DRIFTER',
      tagline: 'High Agility & Cornering',
      price: 150,
      stats: { speed: 75, accel: 80, handling: 90, nitro: 70 },
      width: 46,
      height: 90,
      primaryColor: '#00f0ff',
      stripeColor: '#0284c7',
      windowColor: '#0f172a',
      roofColor: '#0369a1',
      glowColor: '#00f0ff',
      spoiler: true,
      maxSpeed: 195,
      accelRate: 45,
      handlingRate: 6.4,
      nitroPower: 70
    },
    {
      id: 'muscle',
      name: 'V8 THUNDER',
      tagline: 'Raw Muscle & High Acceleration',
      price: 350,
      stats: { speed: 85, accel: 90, handling: 60, nitro: 75 },
      width: 52,
      height: 96,
      primaryColor: '#f59e0b',
      stripeColor: '#18181b',
      windowColor: '#09090b',
      roofColor: '#d97706',
      glowColor: '#f59e0b',
      spoiler: false,
      maxSpeed: 215,
      accelRate: 55,
      handlingRate: 5.0,
      nitroPower: 80
    },
    {
      id: 'hyper',
      name: 'CYBER APEX',
      tagline: 'Extreme Top Speed & Nitro Duration',
      price: 600,
      stats: { speed: 98, accel: 95, handling: 88, nitro: 95 },
      width: 50,
      height: 98,
      primaryColor: '#a855f7',
      stripeColor: '#06b6d4',
      windowColor: '#020617',
      roofColor: '#7e22ce',
      glowColor: '#c084fc',
      spoiler: true,
      maxSpeed: 245,
      accelRate: 65,
      handlingRate: 6.8,
      nitroPower: 95
    },
    {
      id: 'titan',
      name: 'TITAN ENFORCER',
      tagline: 'Heavy Armored Highway Cruiser',
      price: 450,
      stats: { speed: 80, accel: 70, handling: 80, nitro: 85 },
      width: 54,
      height: 102,
      primaryColor: '#10b981',
      stripeColor: '#047857',
      windowColor: '#064e3b',
      roofColor: '#059669',
      glowColor: '#34d399',
      spoiler: false,
      maxSpeed: 205,
      accelRate: 48,
      handlingRate: 5.6,
      nitroPower: 85
    }
  ];

  /* ==========================================================================
     4. ENVIRONMENT DEFINITIONS
     ========================================================================== */

  const ENVIRONMENTS = [
    {
      id: 'sunny',
      name: 'SUNNY COASTWAY',
      tag: 'Daylight & Ocean Breeze',
      icon: '☀️',
      skyGradient: ['#38bdf8', '#0284c7'],
      grassColor: '#166534',
      roadColor: '#1e293b',
      curbColor1: '#ef4444',
      curbColor2: '#f8fafc',
      laneMarkColor: 'rgba(255, 255, 255, 0.85)',
      isNight: false,
      ambientGlow: 'rgba(255, 255, 255, 0.05)'
    },
    {
      id: 'sunset',
      name: 'SUNSET CANYON',
      tag: 'Golden Hour & Desert Dunes',
      icon: '🌅',
      skyGradient: ['#f97316', '#7c2d12'],
      grassColor: '#9a3412',
      roadColor: '#27272a',
      curbColor1: '#f59e0b',
      curbColor2: '#451a03',
      laneMarkColor: 'rgba(254, 240, 138, 0.9)',
      isNight: false,
      ambientGlow: 'rgba(249, 115, 22, 0.12)'
    },
    {
      id: 'night',
      name: 'NIGHT METROPOLIS',
      tag: 'Dark Asphalt & Neon Streetlights',
      icon: '🌙',
      skyGradient: ['#090d16', '#020408'],
      grassColor: '#0f172a',
      roadColor: '#0f172a',
      curbColor1: '#0284c7',
      curbColor2: '#0f172a',
      laneMarkColor: 'rgba(224, 242, 254, 0.95)',
      isNight: true,
      ambientGlow: 'rgba(2, 132, 199, 0.2)'
    },
    {
      id: 'cyber',
      name: 'CYBER GRIDWAY',
      tag: 'Synthwave Neon Hologram',
      icon: '⚡',
      skyGradient: ['#4c1d95', '#0f172a'],
      grassColor: '#1e1b4b',
      roadColor: '#180e29',
      curbColor1: '#ff0066',
      curbColor2: '#00f0ff',
      laneMarkColor: '#00f0ff',
      isNight: true,
      ambientGlow: 'rgba(255, 0, 102, 0.25)'
    }
  ];

  /* ==========================================================================
     5. TRAFFIC VEHICLE TYPES & CONFIGS
     ========================================================================== */

  const TRAFFIC_TYPES = [
    { type: 'compact', name: 'Sedan', width: 44, height: 84, baseSpeed: 85, color: '#3b82f6', windowColor: '#0f172a' },
    { type: 'taxi', name: 'City Taxi', width: 46, height: 86, baseSpeed: 95, color: '#eab308', windowColor: '#0f172a', isTaxi: true },
    { type: 'coupe', name: 'Coupe', width: 45, height: 86, baseSpeed: 110, color: '#ec4899', windowColor: '#0f172a' },
    { type: 'suv', name: 'SUV Cruiser', width: 52, height: 96, baseSpeed: 80, color: '#64748b', windowColor: '#0f172a' },
    { type: 'van', name: 'Cargo Van', width: 52, height: 104, baseSpeed: 75, color: '#f8fafc', windowColor: '#0f172a' },
    { type: 'truck', name: 'Heavy Semi', width: 56, height: 140, baseSpeed: 60, color: '#dc2626', windowColor: '#0f172a', isTruck: true },
    { type: 'supercar', name: 'Phantom GT', width: 46, height: 90, baseSpeed: 140, color: '#8b5cf6', windowColor: '#0f172a' }
  ];

  /* ==========================================================================
     6. MAIN GAME ENGINE
     ========================================================================== */

  const Game = {
    canvas: null,
    ctx: null,
    garageCanvas: null,
    garageCtx: null,

    // Dimensions
    width: 600,
    height: 900,
    dpr: 1,

    // State
    state: 'SPLASH', // 'SPLASH', 'MENU', 'GARAGE', 'ENV_SELECT', 'SETTINGS', 'PLAYING', 'PAUSED', 'GAMEOVER'
    lastTime: 0,
    elapsedTime: 0,

    // Road Properties
    lanesCount: 4,
    roadWidth: 420,
    roadLeft: 90,
    laneWidth: 105,
    roadScrollY: 0,

    // Player State
    player: {
      x: 300,
      y: 720,
      targetX: 300,
      lane: 1,
      speed: 0, // km/h
      minSpeed: 45,
      maxSpeed: 180,
      targetSpeed: 90,
      nitro: 100, // 0 - 100
      isBoosting: false,
      isBraking: false,
      steerTilt: 0,
      width: 48,
      height: 92,
      carIndex: 0,
      powerups: {
        shield: 0, // time remaining
        magnet: 0,
        multiplier: 0,
        unlimitedNitro: 0
      }
    },

    // Progression & Stats
    score: 0,
    distance: 0, // in meters
    sessionCoins: 0,
    overtakes: 0,
    closeCalls: 0,
    combo: 0,
    comboTimer: 0,

    // Collections
    traffic: [],
    coins: [],
    powerups: [],
    particles: [],
    roadsideProps: [],

    // Systems
    spawnTimer: 0,
    propSpawnTimer: 0,
    screenShake: 0,
    shakeX: 0,
    shakeY: 0,
    crashTimeout: null,

    // Inputs
    keys: {
      left: false,
      right: false,
      up: false,
      down: false,
      boost: false,
      brake: false
    },

    /* ------------------------------------------------------------------------
       INITIALIZATION
       ------------------------------------------------------------------------ */
    init() {
      Storage.init();
      Audio.init();

      this.canvas = document.getElementById('gameCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.garageCanvas = document.getElementById('garageCarCanvas');
      this.garageCtx = this.garageCanvas.getContext('2d');

      this.setupResize();
      this.setupInputs();
      this.setupUI();
      this.initSplash();
      this.updateMenuStats();
      this.initRoadsideProps();

      // Start animation loop
      requestAnimationFrame((t) => this.loop(t));
    },

    initSplash() {
      this.state = 'SPLASH';
      const splashScreen = document.getElementById('screen-splash');
      const progressBar = document.getElementById('splash-progress-bar');
      const statusText = document.getElementById('splash-status-text');
      const loadingArea = document.getElementById('splash-loading-area');
      const tapBtn = document.getElementById('splash-btn-play');

      if (!splashScreen) return;

      const steps = [
        { pct: 25, text: 'LOADING GAME ASSETS...' },
        { pct: 55, text: 'TUNING V8 TURBO ENGINES...' },
        { pct: 85, text: 'SYNCHRONIZING HIGHWAY TRAFFIC...' },
        { pct: 100, text: 'READY TO RACE!' }
      ];

      let currentStep = 0;
      const stepInterval = setInterval(() => {
        if (currentStep < steps.length) {
          const s = steps[currentStep];
          if (progressBar) progressBar.style.width = `${s.pct}%`;
          if (statusText) statusText.textContent = s.text;
          currentStep++;
        } else {
          clearInterval(stepInterval);
          setTimeout(() => {
            if (loadingArea) loadingArea.classList.add('hidden');
            if (tapBtn) tapBtn.classList.remove('hidden');
          }, 350);
        }
      }, 350);

      const dismissSplash = () => {
        if (this.state !== 'SPLASH') return;
        Audio.init();
        Audio.resume();
        Audio.playIntroRev();

        splashScreen.classList.add('fade-out');
        setTimeout(() => {
          splashScreen.classList.add('hidden');
          this.showMenu();
        }, 650);
      };

      if (tapBtn) {
        tapBtn.onclick = (e) => {
          e.stopPropagation();
          dismissSplash();
        };
      }

      splashScreen.onclick = () => {
        if (tapBtn && !tapBtn.classList.contains('hidden')) {
          dismissSplash();
        }
      };

      window.addEventListener('keydown', (e) => {
        if (this.state === 'SPLASH' && tapBtn && !tapBtn.classList.contains('hidden')) {
          dismissSplash();
        }
      });
    },

    setupResize() {
      const resize = () => {
        const wrapper = document.getElementById('game-wrapper');
        const w = wrapper.clientWidth || window.innerWidth;
        const h = wrapper.clientHeight || window.innerHeight;

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.width = w;
        this.height = h;

        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.ctx.resetTransform();
        this.ctx.scale(this.dpr, this.dpr);

        // Adjust road geometry based on screen width
        const maxRoadW = 460;
        this.roadWidth = Math.min(w * 0.86, maxRoadW);
        this.roadLeft = (w - this.roadWidth) / 2;
        this.laneWidth = this.roadWidth / this.lanesCount;

        // Player initial placement
        if (this.state === 'SPLASH' || this.state === 'MENU' || this.state === 'GARAGE') {
          this.player.x = this.getLaneX(1);
          this.player.targetX = this.player.x;
          this.player.y = h * 0.78;
        }
      };

      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', resize);
      resize();
    },

    getLaneX(laneIndex) {
      return this.roadLeft + laneIndex * this.laneWidth + this.laneWidth / 2;
    },

    getNearestLane(x) {
      const rel = x - this.roadLeft;
      const l = Math.floor(rel / this.laneWidth);
      return Math.max(0, Math.min(this.lanesCount - 1, l));
    },

    /* ------------------------------------------------------------------------
       USER INPUT HANDLING
       ------------------------------------------------------------------------ */
    setupInputs() {
      // Desktop Keyboard
      window.addEventListener('keydown', (e) => {
        Audio.resume();
        const code = e.code;
        if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
        if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
        if (code === 'ArrowUp' || code === 'KeyW') { this.keys.up = true; this.keys.boost = true; }
        if (code === 'ArrowDown' || code === 'KeyS') { this.keys.down = true; this.keys.brake = true; }
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') this.keys.boost = true;
        if (code === 'KeyP' || code === 'Escape') this.togglePause();
      });

      window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
        if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
        if (code === 'ArrowUp' || code === 'KeyW') { this.keys.up = false; this.keys.boost = false; }
        if (code === 'ArrowDown' || code === 'KeyS') { this.keys.down = false; this.keys.brake = false; }
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') this.keys.boost = false;
      });

      // Mobile On-Screen Buttons
      const bindTouch = (elemId, keyProp) => {
        const el = document.getElementById(elemId);
        if (!el) return;
        const setPress = (val, evt) => {
          if (evt) evt.preventDefault();
          Audio.resume();
          this.keys[keyProp] = val;
          if (val) el.classList.add('active');
          else el.classList.remove('active');
        };
        el.addEventListener('touchstart', (e) => setPress(true, e), { passive: false });
        el.addEventListener('touchend', (e) => setPress(false, e), { passive: false });
        el.addEventListener('touchcancel', (e) => setPress(false, e), { passive: false });
        el.addEventListener('mousedown', (e) => setPress(true, e));
        el.addEventListener('mouseup', (e) => setPress(false, e));
        el.addEventListener('mouseleave', (e) => setPress(false, e));
      };

      bindTouch('touch-left', 'left');
      bindTouch('touch-right', 'right');
      bindTouch('touch-brake', 'brake');
      bindTouch('touch-boost', 'boost');

      // Swipe / Drag Steering Support
      let touchStartX = null;
      window.addEventListener('touchstart', (e) => {
        if (this.state === 'PLAYING' && e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (this.state === 'PLAYING' && touchStartX !== null && e.touches.length > 0) {
          const currentX = e.touches[0].clientX;
          const diff = currentX - touchStartX;
          if (Math.abs(diff) > 20) {
            this.player.targetX += diff * 0.35 * Storage.data.settings.sensitivity;
            touchStartX = currentX;
          }
        }
      }, { passive: true });

      window.addEventListener('touchend', () => {
        touchStartX = null;
      });
    },

    /* ------------------------------------------------------------------------
       UI & DOM CONTROLLER
       ------------------------------------------------------------------------ */
    setupUI() {
      // Main Menu Buttons
      document.getElementById('btn-play').onclick = () => {
        Audio.init();
        Audio.resume();
        Audio.playClick();
        this.startGame();
      };
      document.getElementById('btn-garage').onclick = () => {
        Audio.playClick();
        this.openGarage();
      };
      document.getElementById('btn-environment').onclick = () => {
        Audio.playClick();
        this.openEnvironmentSelector();
      };
      document.getElementById('btn-settings').onclick = () => {
        Audio.playClick();
        this.openSettings();
      };

      // In-Game Pause
      document.getElementById('btn-pause').onclick = () => {
        this.togglePause();
      };
      document.getElementById('pause-btn-resume').onclick = () => {
        Audio.playClick();
        this.resumeGame();
      };
      document.getElementById('pause-btn-restart').onclick = () => {
        Audio.playClick();
        this.startGame();
      };
      document.getElementById('pause-btn-menu').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };

      // Game Over Buttons
      document.getElementById('go-btn-restart').onclick = () => {
        Audio.playClick();
        this.startGame();
      };
      document.getElementById('go-btn-garage').onclick = () => {
        Audio.playClick();
        this.openGarage();
      };
      document.getElementById('go-btn-menu').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };

      // Garage Actions
      document.getElementById('garage-btn-close').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };
      document.getElementById('garage-prev').onclick = () => {
        Audio.playClick();
        this.cycleGarageCar(-1);
      };
      document.getElementById('garage-next').onclick = () => {
        Audio.playClick();
        this.cycleGarageCar(1);
      };
      document.getElementById('garage-btn-action').onclick = () => {
        this.handleGarageAction();
      };

      // Environment Selector
      document.getElementById('env-btn-close').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };
      document.getElementById('env-btn-confirm').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };

      // Settings Modal
      document.getElementById('settings-btn-close').onclick = () => {
        Audio.playClick();
        this.showMenu();
      };
      document.getElementById('settings-btn-save').onclick = () => {
        Audio.playClick();
        this.saveSettingsFromUI();
        this.showMenu();
      };
    },

    updateMenuStats() {
      document.getElementById('menu-best-score').textContent = Storage.data.bestScore.toLocaleString();
      document.getElementById('menu-total-coins').textContent = `🪙 ${Storage.data.coins}`;
      document.getElementById('menu-best-dist').textContent = `${(Storage.data.bestDistance / 1000).toFixed(1)} KM`;
    },

    showScreen(id) {
      document.querySelectorAll('.screen-modal').forEach((m) => m.classList.add('hidden'));
      document.getElementById('hud').classList.add('hidden');

      if (id === 'hud') {
        document.getElementById('hud').classList.remove('hidden');
      } else {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
      }
    },

    showMenu() {
      this.state = 'MENU';
      if (this.crashTimeout) {
        clearTimeout(this.crashTimeout);
        this.crashTimeout = null;
      }
      Audio.stopEngine();
      Audio.stopNitro();
      Audio.stopMusic();
      this.updateMenuStats();
      this.showScreen('screen-menu');
    },

    openGarage() {
      this.state = 'GARAGE';
      this.garageViewingIndex = Storage.data.selectedCar;
      this.updateGarageUI();
      this.showScreen('screen-garage');
    },

    openEnvironmentSelector() {
      this.state = 'ENV_SELECT';
      const container = document.getElementById('env-grid');
      container.innerHTML = '';
      ENVIRONMENTS.forEach((env, idx) => {
        const card = document.createElement('div');
        card.className = `env-card ${idx === Storage.data.selectedEnv ? 'active' : ''}`;
        card.innerHTML = `
          <div class="env-icon">${env.icon}</div>
          <div class="env-name">${env.name}</div>
          <div class="env-tag">${env.tag}</div>
        `;
        card.onclick = () => {
          Audio.playClick();
          Storage.data.selectedEnv = idx;
          Storage.save();
          document.querySelectorAll('.env-card').forEach((c, i) => c.classList.toggle('active', i === idx));
        };
        container.appendChild(card);
      });
      this.showScreen('screen-environment');
    },

    openSettings() {
      this.state = 'SETTINGS';
      document.getElementById('set-sound').checked = Storage.data.settings.sound;
      document.getElementById('set-music').checked = Storage.data.settings.music;
      document.getElementById('set-shake').checked = Storage.data.settings.shake;
      document.getElementById('set-sensitivity').value = Storage.data.settings.sensitivity;
      this.showScreen('screen-settings');
    },

    saveSettingsFromUI() {
      Storage.data.settings.sound = document.getElementById('set-sound').checked;
      Storage.data.settings.music = document.getElementById('set-music').checked;
      Storage.data.settings.shake = document.getElementById('set-shake').checked;
      Storage.data.settings.sensitivity = parseFloat(document.getElementById('set-sensitivity').value) || 1.0;
      Storage.save();
    },

    /* ------------------------------------------------------------------------
       GARAGE LOGIC
       ------------------------------------------------------------------------ */
    garageViewingIndex: 0,

    cycleGarageCar(dir) {
      this.garageViewingIndex = (this.garageViewingIndex + dir + CARS.length) % CARS.length;
      this.updateGarageUI();
    },

    updateGarageUI() {
      const car = CARS[this.garageViewingIndex];
      const isUnlocked = Storage.data.unlockedCars.includes(this.garageViewingIndex);
      const isSelected = Storage.data.selectedCar === this.garageViewingIndex;

      document.getElementById('garage-car-name').textContent = car.name;
      document.getElementById('garage-car-tag').textContent = car.tagline;

      document.getElementById('stat-speed-bar').style.width = `${car.stats.speed}%`;
      document.getElementById('stat-accel-bar').style.width = `${car.stats.accel}%`;
      document.getElementById('stat-handling-bar').style.width = `${car.stats.handling}%`;
      document.getElementById('stat-nitro-bar').style.width = `${car.stats.nitro}%`;

      const btn = document.getElementById('garage-btn-action');
      const btnText = document.getElementById('garage-action-text');

      if (isSelected) {
        btnText.textContent = '✓ SELECTED';
        btn.className = 'btn btn-secondary btn-block';
      } else if (isUnlocked) {
        btnText.textContent = 'SELECT CAR';
        btn.className = 'btn btn-primary btn-block';
      } else {
        btnText.textContent = `UNLOCK (🪙 ${car.price})`;
        btn.className = Storage.data.coins >= car.price ? 'btn btn-primary btn-block' : 'btn btn-secondary btn-block';
      }

      // Render Dots
      const dotsContainer = document.getElementById('garage-car-dots');
      dotsContainer.innerHTML = '';
      CARS.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `dot ${i === this.garageViewingIndex ? 'active' : ''}`;
        dotsContainer.appendChild(dot);
      });

      // Render preview vehicle on garage canvas
      this.renderGaragePreview(car);
    },

    handleGarageAction() {
      const car = CARS[this.garageViewingIndex];
      const isUnlocked = Storage.data.unlockedCars.includes(this.garageViewingIndex);

      if (isUnlocked) {
        Storage.data.selectedCar = this.garageViewingIndex;
        Storage.save();
        Audio.playClick();
        this.updateGarageUI();
      } else if (Storage.data.coins >= car.price) {
        Storage.data.coins -= car.price;
        Storage.data.unlockedCars.push(this.garageViewingIndex);
        Storage.data.selectedCar = this.garageViewingIndex;
        Storage.save();
        Audio.playPowerup();
        this.updateGarageUI();
      } else {
        Audio.playBrake();
      }
    },

    renderGaragePreview(car) {
      const gctx = this.garageCtx;
      gctx.clearRect(0, 0, 280, 240);

      // Rotating glow background
      const grad = gctx.createRadialGradient(140, 120, 20, 140, 120, 100);
      grad.addColorStop(0, `${car.glowColor}44`);
      grad.addColorStop(1, 'transparent');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 280, 240);

      // Draw Car centered
      gctx.save();
      gctx.translate(140, 120);
      gctx.scale(1.4, 1.4);
      this.drawVehicle(gctx, {
        x: 0,
        y: 0,
        width: car.width,
        height: car.height,
        primaryColor: car.primaryColor,
        stripeColor: car.stripeColor,
        windowColor: car.windowColor,
        roofColor: car.roofColor,
        glowColor: car.glowColor,
        spoiler: car.spoiler,
        steerTilt: 0,
        isPlayer: true
      });
      gctx.restore();
    },

    /* ------------------------------------------------------------------------
       GAMEPLAY LIFECYCLE
       ------------------------------------------------------------------------ */
    startGame() {
      if (this.crashTimeout) {
        clearTimeout(this.crashTimeout);
        this.crashTimeout = null;
      }
      this.state = 'PLAYING';
      this.showScreen('hud');

      const selectedCarData = CARS[Storage.data.selectedCar] || CARS[0];
      this.player.carIndex = Storage.data.selectedCar;
      this.player.width = selectedCarData.width;
      this.player.height = selectedCarData.height;
      this.player.maxSpeed = selectedCarData.maxSpeed;
      this.player.x = this.getLaneX(1);
      this.player.targetX = this.player.x;
      this.player.y = this.height * 0.76;
      this.player.speed = this.player.minSpeed;
      this.player.targetSpeed = 90;
      this.player.nitro = 100;
      this.player.steerTilt = 0;
      this.player.powerups = { shield: 0, magnet: 0, multiplier: 0, unlimitedNitro: 0 };

      this.score = 0;
      this.distance = 0;
      this.sessionCoins = 0;
      this.overtakes = 0;
      this.closeCalls = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.screenShake = 0;

      this.traffic = [];
      this.coins = [];
      this.powerups = [];
      this.particles = [];
      this.spawnTimer = 0;

      Audio.startEngine();
      Audio.startMusic();

      this.updateHUD();
    },

    togglePause() {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        Audio.stopEngine();
        Audio.stopNitro();
        Audio.stopMusic();

        document.getElementById('pause-score').textContent = Math.floor(this.score).toLocaleString();
        document.getElementById('pause-dist').textContent = `${(this.distance / 1000).toFixed(1)} KM`;
        document.getElementById('pause-overtakes').textContent = this.overtakes;

        this.showScreen('screen-pause');
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    },

    resumeGame() {
      this.state = 'PLAYING';
      Audio.startEngine();
      Audio.startMusic();
      this.showScreen('hud');
    },

    triggerCrash() {
      this.state = 'GAMEOVER';
      if (this.crashTimeout) clearTimeout(this.crashTimeout);
      Audio.stopEngine();
      Audio.stopNitro();
      Audio.stopMusic();
      Audio.playCrash();

      this.addScreenShake(24);

      // Create burst particles
      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 60 + Math.random() * 260;
        this.particles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: 1.0,
          decay: 0.8 + Math.random() * 0.8,
          size: 4 + Math.random() * 8,
          color: Math.random() > 0.4 ? '#ff3300' : '#ffcc00'
        });
      }

      // Save Best Stats
      const finalScore = Math.floor(this.score);
      const isNewBest = finalScore > Storage.data.bestScore;
      if (isNewBest) Storage.data.bestScore = finalScore;
      if (this.distance > Storage.data.bestDistance) Storage.data.bestDistance = this.distance;
      Storage.data.coins += this.sessionCoins;
      Storage.save();

      // Show Game Over UI after brief impact delay
      this.crashTimeout = setTimeout(() => {
        this.crashTimeout = null;
        document.getElementById('gameover-new-record').classList.toggle('hidden', !isNewBest);
        document.getElementById('go-score').textContent = finalScore.toLocaleString();
        document.getElementById('go-distance').textContent = `${(this.distance / 1000).toFixed(1)} KM`;
        document.getElementById('go-overtakes').textContent = this.overtakes;
        document.getElementById('go-nearmiss').textContent = this.closeCalls;
        document.getElementById('go-coins').textContent = `+${this.sessionCoins}`;
        document.getElementById('go-best-score').textContent = Storage.data.bestScore.toLocaleString();

        this.showScreen('screen-gameover');
      }, 700);
    },

    /* ------------------------------------------------------------------------
       POPUP & FLOATING FEEDBACK
       ------------------------------------------------------------------------ */
    showPopup(text, type = 'overtake-combo') {
      const container = document.getElementById('popup-container');
      const el = document.createElement('div');
      el.className = `hud-popup ${type}`;
      el.textContent = text;
      container.appendChild(el);
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 1200);
    },

    addScreenShake(intensity) {
      if (Storage.data.settings.shake) {
        this.screenShake = Math.min(this.screenShake + intensity, 30);
      }
    },

    /* ------------------------------------------------------------------------
       ROADSIDE PROPS ENGINE
       ------------------------------------------------------------------------ */
    initRoadsideProps() {
      this.roadsideProps = [];
      for (let i = 0; i < 16; i++) {
        this.spawnRoadsideProp(Math.random() * this.height);
      }
    },

    spawnRoadsideProp(yPos = -60) {
      const side = Math.random() > 0.5 ? 'left' : 'right';
      const offset = 30 + Math.random() * 80;
      const x = side === 'left' ? this.roadLeft - offset : this.roadLeft + this.roadWidth + offset;
      const propTypes = ['tree', 'lamp', 'sign', 'barrier'];
      const type = propTypes[Math.floor(Math.random() * propTypes.length)];

      this.roadsideProps.push({
        x,
        y: yPos,
        side,
        type,
        size: 24 + Math.random() * 20,
        color: type === 'tree' ? '#15803d' : '#94a3b8'
      });
    },

    /* ------------------------------------------------------------------------
       TRAFFIC & SPAWNER ENGINE
       ------------------------------------------------------------------------ */
    spawnTraffic() {
      // Progressive Difficulty based on distance
      const distKm = this.distance / 1000;
      let maxTraffic = 3;
      if (distKm > 2) maxTraffic = 4;
      if (distKm > 5) maxTraffic = 6;
      if (distKm > 10) maxTraffic = 7;

      if (this.traffic.length >= maxTraffic) return;

      // Determine available lanes and safe gaps
      const occupiedLanes = this.traffic.filter((t) => t.y < 120).map((t) => t.lane);
      const freeLanes = [];
      for (let l = 0; l < this.lanesCount; l++) {
        if (!occupiedLanes.includes(l)) freeLanes.push(l);
      }

      // Guarantee at least 1 escape lane remains open
      if (freeLanes.length === 0) return;

      const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
      const typeDef = TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];

      const trafficCar = {
        x: this.getLaneX(lane),
        y: -160 - Math.random() * 120,
        lane,
        targetX: this.getLaneX(lane),
        type: typeDef.type,
        width: typeDef.width,
        height: typeDef.height,
        speed: typeDef.baseSpeed + (Math.random() * 20 - 10),
        primaryColor: typeDef.color,
        stripeColor: '#ffffff',
        windowColor: typeDef.windowColor,
        roofColor: typeDef.color,
        glowColor: '#ffffff',
        spoiler: false,
        steerTilt: 0,
        isTaxi: typeDef.isTaxi,
        isTruck: typeDef.isTruck,
        passed: false,
        laneChangeTimer: 2 + Math.random() * 5,
        turnSignal: null // 'left' | 'right' | null
      };

      this.traffic.push(trafficCar);
    },

    /* ------------------------------------------------------------------------
       PICKUPS & POWERUPS ENGINE
       ------------------------------------------------------------------------ */
    spawnPickups() {
      // Spawn Coins
      if (Math.random() < 0.03 && this.coins.length < 10) {
        const lane = Math.floor(Math.random() * this.lanesCount);
        const count = 3 + Math.floor(Math.random() * 3);
        const startY = -100;
        for (let i = 0; i < count; i++) {
          this.coins.push({
            x: this.getLaneX(lane),
            y: startY - i * 45,
            size: 16,
            rotation: 0
          });
        }
      }

      // Spawn Power-up Orbs
      if (Math.random() < 0.006 && this.powerups.length < 2) {
        const lane = Math.floor(Math.random() * this.lanesCount);
        const types = ['shield', 'magnet', 'multiplier', 'nitro'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups.push({
          x: this.getLaneX(lane),
          y: -120,
          type,
          size: 22,
          pulse: 0
        });
      }
    },

    /* ------------------------------------------------------------------------
       UPDATE ENGINE (DELTA TIME)
       ------------------------------------------------------------------------ */
    update(dt) {
      if (this.state !== 'PLAYING') return;

      const carData = CARS[Storage.data.selectedCar] || CARS[0];

      // 1. Player Physics & Controls
      const handling = (carData.handlingRate || 5.5) * Storage.data.settings.sensitivity;
      if (this.keys.left) {
        this.player.targetX -= handling * 60 * dt;
        this.player.steerTilt = Math.max(this.player.steerTilt - 6 * dt, -0.16);
      } else if (this.keys.right) {
        this.player.targetX += handling * 60 * dt;
        this.player.steerTilt = Math.min(this.player.steerTilt + 6 * dt, 0.16);
      } else {
        this.player.steerTilt *= Math.pow(0.05, dt);
      }

      // Clamp player within road limits
      const halfW = this.player.width / 2;
      const minX = this.roadLeft + halfW + 6;
      const maxX = this.roadLeft + this.roadWidth - halfW - 6;
      this.player.targetX = Math.max(minX, Math.min(maxX, this.player.targetX));
      this.player.x += (this.player.targetX - this.player.x) * (14 * dt);
      this.player.lane = this.getNearestLane(this.player.x);

      // 2. Speed, Acceleration & Nitro
      const isUnlimitedNitro = this.player.powerups.unlimitedNitro > 0;
      const wantsBoost = (this.keys.boost || this.keys.up) && (this.player.nitro > 0 || isUnlimitedNitro);

      if (wantsBoost) {
        this.player.isBoosting = true;
        this.player.targetSpeed = this.player.maxSpeed * 1.35;
        if (!isUnlimitedNitro) {
          this.player.nitro = Math.max(0, this.player.nitro - 25 * dt);
        }
        Audio.startNitro();
        this.addScreenShake(0.6);

        // Nitro exhaust flames
        if (Math.random() < 0.7) {
          this.particles.push({
            x: this.player.x - 12 + (Math.random() * 6),
            y: this.player.y + this.player.height / 2 + 4,
            vx: (Math.random() - 0.5) * 30,
            vy: 200 + Math.random() * 100,
            life: 0.35,
            decay: 2.8,
            size: 5 + Math.random() * 4,
            color: '#00f0ff'
          });
          this.particles.push({
            x: this.player.x + 12 + (Math.random() * 6),
            y: this.player.y + this.player.height / 2 + 4,
            vx: (Math.random() - 0.5) * 30,
            vy: 200 + Math.random() * 100,
            life: 0.35,
            decay: 2.8,
            size: 5 + Math.random() * 4,
            color: '#00f0ff'
          });
        }
      } else {
        this.player.isBoosting = false;
        Audio.stopNitro();
        if (this.keys.brake || this.keys.down) {
          this.player.isBraking = true;
          this.player.targetSpeed = this.player.minSpeed;
          // Brake tire smoke
          if (this.player.speed > 80 && Math.random() < 0.4) {
            this.particles.push({
              x: this.player.x + (Math.random() > 0.5 ? -16 : 16),
              y: this.player.y + this.player.height / 2,
              vx: (Math.random() - 0.5) * 20,
              vy: 120,
              life: 0.4,
              decay: 2.5,
              size: 4 + Math.random() * 6,
              color: 'rgba(255,255,255,0.4)'
            });
          }
        } else {
          this.player.isBraking = false;
          this.player.targetSpeed = this.player.maxSpeed * 0.72;
          // Slowly recharge Nitro
          this.player.nitro = Math.min(100, this.player.nitro + 6 * dt);
        }
      }

      // Smooth Speed Interpolation
      const accel = (this.player.isBoosting ? 65 : (this.player.isBraking ? 95 : 35)) * dt;
      if (this.player.speed < this.player.targetSpeed) {
        this.player.speed = Math.min(this.player.targetSpeed, this.player.speed + accel);
      } else {
        this.player.speed = Math.max(this.player.targetSpeed, this.player.speed - accel);
      }

      Audio.updateEngine(this.player.speed / this.player.maxSpeed);

      // 3. Distance & Score Progression
      const speedMs = (this.player.speed * 1000) / 3600; // km/h to m/s
      const distDelta = speedMs * dt;
      this.distance += distDelta;

      const scoreMultiplier = this.player.powerups.multiplier > 0 ? 2 : 1;
      this.score += (this.player.speed * 0.15) * dt * scoreMultiplier;

      // Combo Decay
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
        }
      }

      // Power-up Timers
      for (const k in this.player.powerups) {
        if (this.player.powerups[k] > 0) {
          this.player.powerups[k] = Math.max(0, this.player.powerups[k] - dt);
        }
      }

      // Road Scroll
      const roadPixelsPerSec = this.player.speed * 7.5;
      this.roadScrollY = (this.roadScrollY + roadPixelsPerSec * dt) % 100;

      // 4. Update Roadside Props
      this.propSpawnTimer += dt;
      if (this.propSpawnTimer > 0.25) {
        this.propSpawnTimer = 0;
        this.spawnRoadsideProp(-60);
      }
      for (let i = this.roadsideProps.length - 1; i >= 0; i--) {
        const prop = this.roadsideProps[i];
        prop.y += roadPixelsPerSec * dt;
        if (prop.y > this.height + 100) {
          this.roadsideProps.splice(i, 1);
        }
      }

      // 5. Update Traffic AI
      this.spawnTimer += dt;
      if (this.spawnTimer > 1.2) {
        this.spawnTimer = 0;
        this.spawnTraffic();
      }

      for (let i = this.traffic.length - 1; i >= 0; i--) {
        const car = this.traffic[i];
        // Relative speed movement
        const relSpeed = (this.player.speed - car.speed) * 7.5;
        car.y += relSpeed * dt;

        // AI Lane changing behavior
        car.laneChangeTimer -= dt;
        if (car.laneChangeTimer <= 0) {
          car.laneChangeTimer = 3 + Math.random() * 6;
          // Attempt lane switch
          const dir = Math.random() > 0.5 ? 1 : -1;
          const targetLane = car.lane + dir;
          if (targetLane >= 0 && targetLane < this.lanesCount) {
            car.lane = targetLane;
            car.targetX = this.getLaneX(targetLane);
            car.turnSignal = dir > 0 ? 'right' : 'left';
            setTimeout(() => { car.turnSignal = null; }, 1400);
          }
        }

        // Smooth X steering towards target lane
        car.x += (car.targetX - car.x) * (4 * dt);

        // Overtake & Near-Miss Detection
        if (!car.passed && car.y > this.player.y + this.player.height * 0.4) {
          car.passed = true;
          this.overtakes++;
          this.combo++;
          this.comboTimer = 2.5;

          const comboBonus = Math.min(this.combo, 10);
          const points = (15 * comboBonus) * scoreMultiplier;
          this.score += points;

          // Check for Close Call (lateral proximity)
          const latDist = Math.abs(this.player.x - car.x);
          if (latDist < (this.player.width / 2 + car.width / 2 + 18)) {
            this.closeCalls++;
            const closeBonus = 50 * scoreMultiplier;
            this.score += closeBonus;
            Audio.playCloseCall();
            this.showPopup(`⚡ CLOSE CALL! +${closeBonus}`, 'close-call');
            this.addScreenShake(3);
          } else {
            Audio.playOvertake();
            if (this.combo > 1) {
              this.showPopup(`OVERTAKE x${this.combo}!`, 'overtake-combo');
            }
          }
        }

        // Collision Detection with Player
        const padX = 8;
        const padY = 10;
        const pLeft = this.player.x - this.player.width / 2 + padX;
        const pRight = this.player.x + this.player.width / 2 - padX;
        const pTop = this.player.y - this.player.height / 2 + padY;
        const pBottom = this.player.y + this.player.height / 2 - padY;

        const cLeft = car.x - car.width / 2 + padX;
        const cRight = car.x + car.width / 2 - padX;
        const cTop = car.y - car.height / 2 + padY;
        const cBottom = car.y + car.height / 2 - padY;

        if (pLeft < cRight && pRight > cLeft && pTop < cBottom && pBottom > cTop) {
          // If Shield active, absorb impact!
          if (this.player.powerups.shield > 0) {
            this.player.powerups.shield = 0;
            Audio.playShieldDeflect();
            this.addScreenShake(12);
            // Knock car forward
            car.y -= 250;
            car.speed = 140;
            this.showPopup('🛡️ SHIELD SAVED YOU!', 'close-call');
          } else {
            this.triggerCrash();
            return;
          }
        }

        // Remove offscreen traffic
        if (car.y > this.height + 250 || car.y < -400) {
          this.traffic.splice(i, 1);
        }
      }

      // 6. Update Coins & Collectibles
      this.spawnPickups();
      const magnetActive = this.player.powerups.magnet > 0;

      for (let i = this.coins.length - 1; i >= 0; i--) {
        const coin = this.coins[i];
        coin.y += roadPixelsPerSec * dt;
        coin.rotation += 4 * dt;

        // Magnet attraction
        if (magnetActive) {
          const dx = this.player.x - coin.x;
          const dy = this.player.y - coin.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 260) {
            coin.x += (dx / dist) * 350 * dt;
            coin.y += (dy / dist) * 350 * dt;
          }
        }

        // Collection detection
        const cdist = Math.hypot(this.player.x - coin.x, this.player.y - coin.y);
        if (cdist < (this.player.width / 2 + coin.size)) {
          this.sessionCoins++;
          this.score += 50 * scoreMultiplier;
          Audio.playCoin();
          // Coin sparkles
          for (let p = 0; p < 8; p++) {
            this.particles.push({
              x: coin.x,
              y: coin.y,
              vx: (Math.random() - 0.5) * 120,
              vy: (Math.random() - 0.5) * 120,
              life: 0.4,
              decay: 2.2,
              size: 3 + Math.random() * 3,
              color: '#ffb700'
            });
          }
          this.coins.splice(i, 1);
          continue;
        }

        if (coin.y > this.height + 100) {
          this.coins.splice(i, 1);
        }
      }

      // 7. Update Power-ups
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pup = this.powerups[i];
        pup.y += roadPixelsPerSec * dt;
        pup.pulse += 5 * dt;

        const pdist = Math.hypot(this.player.x - pup.x, this.player.y - pup.y);
        if (pdist < (this.player.width / 2 + pup.size)) {
          Audio.playPowerup();
          if (pup.type === 'shield') {
            this.player.powerups.shield = 15;
            this.showPopup('🛡️ SHIELD ACTIVE!', 'overtake-combo');
          } else if (pup.type === 'magnet') {
            this.player.powerups.magnet = 10;
            this.showPopup('🧲 COIN MAGNET!', 'overtake-combo');
          } else if (pup.type === 'multiplier') {
            this.player.powerups.multiplier = 10;
            this.showPopup('⭐ 2X MULTIPLIER!', 'overtake-combo');
          } else if (pup.type === 'nitro') {
            this.player.powerups.unlimitedNitro = 6;
            this.player.nitro = 100;
            this.showPopup('⚡ NITRO SURGE!', 'overtake-combo');
          }
          this.powerups.splice(i, 1);
          continue;
        }

        if (pup.y > this.height + 100) {
          this.powerups.splice(i, 1);
        }
      }

      // 8. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= p.decay * dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }

      // 9. Update Screen Shake
      if (this.screenShake > 0) {
        this.shakeX = (Math.random() * 2 - 1) * this.screenShake;
        this.shakeY = (Math.random() * 2 - 1) * this.screenShake;
        this.screenShake = Math.max(0, this.screenShake - 30 * dt);
      } else {
        this.shakeX = 0;
        this.shakeY = 0;
      }

      this.updateHUD();
    },

    updateHUD() {
      document.getElementById('hud-score').textContent = Math.floor(this.score).toLocaleString();
      document.getElementById('hud-distance').innerHTML = `${(this.distance / 1000).toFixed(1)} <span class="unit">KM</span>`;
      document.getElementById('hud-coins-val').textContent = Storage.data.coins + this.sessionCoins;
      document.getElementById('hud-speed').textContent = Math.floor(this.player.speed);

      const nitroPct = Math.round(this.player.nitro);
      document.getElementById('nitro-bar').style.width = `${nitroPct}%`;
      document.getElementById('nitro-status').textContent = this.player.powerups.unlimitedNitro > 0 ? '⚡ INFINITE' : `${nitroPct}%`;

      // Active Powerups Bar
      const powerupsContainer = document.getElementById('powerups-hud');
      powerupsContainer.innerHTML = '';

      if (this.player.powerups.shield > 0) {
        powerupsContainer.innerHTML += `<div class="powerup-badge shield">🛡️ SHIELD (${Math.ceil(this.player.powerups.shield)}s)</div>`;
      }
      if (this.player.powerups.magnet > 0) {
        powerupsContainer.innerHTML += `<div class="powerup-badge magnet">🧲 MAGNET (${Math.ceil(this.player.powerups.magnet)}s)</div>`;
      }
      if (this.player.powerups.multiplier > 0) {
        powerupsContainer.innerHTML += `<div class="powerup-badge multiplier">⭐ 2X BOOST (${Math.ceil(this.player.powerups.multiplier)}s)</div>`;
      }
      if (this.player.powerups.unlimitedNitro > 0) {
        powerupsContainer.innerHTML += `<div class="powerup-badge shield">⚡ NITRO SURGE (${Math.ceil(this.player.powerups.unlimitedNitro)}s)</div>`;
      }
    },

    /* ------------------------------------------------------------------------
       CANVAS RENDERING PIPELINE
       ------------------------------------------------------------------------ */
    render() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      const env = ENVIRONMENTS[Storage.data.selectedEnv] || ENVIRONMENTS[0];

      ctx.save();
      ctx.translate(this.shakeX, this.shakeY);
      ctx.clearRect(-50, -50, w + 100, h + 100);

      // 1. Background Grass / Environment Sides
      const skyGrad = ctx.createLinearGradient(0, 0, w, 0);
      skyGrad.addColorStop(0, env.grassColor);
      skyGrad.addColorStop(1, env.grassColor);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-50, -50, w + 100, h + 100);

      // 2. Road Surface
      ctx.fillStyle = env.roadColor;
      ctx.fillRect(this.roadLeft, 0, this.roadWidth, h);

      // 3. Road Curb / Shoulder Barriers
      const curbWidth = 10;
      const curbSegmentHeight = 40;
      const numSegments = Math.ceil(h / curbSegmentHeight) + 2;

      for (let i = 0; i < numSegments; i++) {
        const segY = (i * curbSegmentHeight + this.roadScrollY * 0.8) % (numSegments * curbSegmentHeight) - curbSegmentHeight;
        ctx.fillStyle = (i % 2 === 0) ? env.curbColor1 : env.curbColor2;

        // Left curb
        ctx.fillRect(this.roadLeft - curbWidth, segY, curbWidth, curbSegmentHeight);
        // Right curb
        ctx.fillRect(this.roadLeft + this.roadWidth, segY, curbWidth, curbSegmentHeight);
      }

      // 4. Dashed Lane Markings
      ctx.fillStyle = env.laneMarkColor;
      const dashHeight = 45;
      const gapHeight = 35;
      const totalDash = dashHeight + gapHeight;
      const numDashes = Math.ceil(h / totalDash) + 2;

      for (let l = 1; l < this.lanesCount; l++) {
        const laneX = this.roadLeft + l * this.laneWidth;
        for (let d = 0; d < numDashes; d++) {
          const dashY = (d * totalDash + this.roadScrollY) % (numDashes * totalDash) - totalDash;
          ctx.fillRect(laneX - 3, dashY, 6, dashHeight);
        }
      }

      // 5. Roadside Props (Trees, Signs, Lamps)
      this.roadsideProps.forEach((prop) => {
        this.drawRoadsideProp(ctx, prop, env);
      });

      // 6. Collectible Coins
      this.coins.forEach((coin) => {
        this.drawCoin(ctx, coin);
      });

      // 7. Power-up Orbs
      this.powerups.forEach((pup) => {
        this.drawPowerup(ctx, pup);
      });

      // 8. Traffic Vehicles
      this.traffic.forEach((car) => {
        this.drawVehicle(ctx, {
          x: car.x,
          y: car.y,
          width: car.width,
          height: car.height,
          primaryColor: car.primaryColor,
          stripeColor: car.stripeColor,
          windowColor: car.windowColor,
          roofColor: car.roofColor,
          glowColor: car.glowColor,
          spoiler: car.spoiler,
          steerTilt: car.steerTilt,
          isTaxi: car.isTaxi,
          isTruck: car.isTruck,
          turnSignal: car.turnSignal,
          isNight: env.isNight,
          isPlayer: false
        });
      });

      // 9. Player Vehicle
      const playerCarData = CARS[Storage.data.selectedCar] || CARS[0];
      this.drawVehicle(ctx, {
        x: this.player.x,
        y: this.player.y,
        width: this.player.width,
        height: this.player.height,
        primaryColor: playerCarData.primaryColor,
        stripeColor: playerCarData.stripeColor,
        windowColor: playerCarData.windowColor,
        roofColor: playerCarData.roofColor,
        glowColor: playerCarData.glowColor,
        spoiler: playerCarData.spoiler,
        steerTilt: this.player.steerTilt,
        isNight: env.isNight,
        isPlayer: true
      });

      // Shield force field ring
      if (this.player.powerups.shield > 0) {
        ctx.save();
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.player.x, this.player.y, this.player.height * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fill();
        ctx.restore();
      }

      // 10. Particles (Smoke, Sparks, Flames)
      this.particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 11. Speed Warp Lines during Nitro / High Speed
      if (this.player.isBoosting || this.player.speed > 180) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 14; i++) {
          const rx = this.roadLeft + Math.random() * this.roadWidth;
          const ry = Math.random() * h;
          const len = 40 + Math.random() * 80;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx, ry + len);
          ctx.stroke();
        }
      }

      ctx.restore();
    },

    /* ------------------------------------------------------------------------
       PROCEDURAL VECTOR VEHICLE DRAWING
       ------------------------------------------------------------------------ */
    drawVehicle(ctx, opts) {
      const {
        x, y, width, height, primaryColor, stripeColor,
        windowColor, roofColor, glowColor, spoiler, steerTilt,
        isTaxi, isTruck, turnSignal, isNight, isPlayer
      } = opts;

      ctx.save();
      ctx.translate(x, y);
      if (steerTilt) ctx.rotate(steerTilt);

      const hw = width / 2;
      const hh = height / 2;

      // 1. Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.fillRoundedRect(ctx, -hw + 4, -hh + 6, width, height, 10);

      // 2. Wheels / Tires (4 tires)
      ctx.fillStyle = '#0f172a';
      const wheelW = 7;
      const wheelH = 18;
      // Front Left & Right
      ctx.fillRect(-hw - 3, -hh + 12, wheelW, wheelH);
      ctx.fillRect(hw - 4, -hh + 12, wheelW, wheelH);
      // Rear Left & Right
      ctx.fillRect(-hw - 3, hh - 28, wheelW, wheelH);
      ctx.fillRect(hw - 4, hh - 28, wheelW, wheelH);

      // 3. Car Main Body Chassis
      ctx.fillStyle = primaryColor;
      this.fillRoundedRect(ctx, -hw, -hh, width, height, 12);

      // 4. Center Racing Stripe
      if (stripeColor) {
        ctx.fillStyle = stripeColor;
        ctx.fillRect(-4, -hh + 2, 8, height - 4);
      }

      // 5. Windows & Windshields
      ctx.fillStyle = windowColor || '#090d16';
      // Front Windshield
      ctx.beginPath();
      ctx.moveTo(-hw + 8, -hh + 24);
      ctx.lineTo(hw - 8, -hh + 24);
      ctx.lineTo(hw - 10, -hh + 40);
      ctx.lineTo(-hw + 10, -hh + 40);
      ctx.closePath();
      ctx.fill();

      // Rear Windshield
      ctx.beginPath();
      ctx.moveTo(-hw + 9, hh - 22);
      ctx.lineTo(hw - 9, hh - 22);
      ctx.lineTo(hw - 8, hh - 34);
      ctx.lineTo(-hw + 8, hh - 34);
      ctx.closePath();
      ctx.fill();

      // Side Windows
      ctx.fillRect(-hw + 5, -hh + 40, 4, height - 64);
      ctx.fillRect(hw - 9, -hh + 40, 4, height - 64);

      // 6. Roof Section
      ctx.fillStyle = roofColor || primaryColor;
      this.fillRoundedRect(ctx, -hw + 9, -hh + 40, width - 18, height - 64, 4);

      // 7. Taxi Sign or Truck Features
      if (isTaxi) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-12, -hh + 48, 24, 10);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TAXI', 0, -hh + 56);
      }

      if (isTruck) {
        // Cargo container ridges
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        for (let r = -hh + 40; r < hh - 10; r += 16) {
          ctx.beginPath();
          ctx.moveTo(-hw + 6, r);
          ctx.lineTo(hw - 6, r);
          ctx.stroke();
        }
      }

      // 8. Rear Spoiler
      if (spoiler) {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(-hw + 4, hh - 4, width - 8, 5);
        ctx.fillStyle = primaryColor;
        ctx.fillRect(-hw + 2, hh - 2, width - 4, 3);
      }

      // 9. Headlights (Front White/Cyan LEDs)
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(-hw + 6, -hh + 2, 8, 4);
      ctx.fillRect(hw - 14, -hh + 2, 8, 4);

      // Night Headlight Beams projection
      if (isNight || isPlayer) {
        const beamGrad = ctx.createLinearGradient(0, -hh, 0, -hh - 140);
        beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(-hw + 4, -hh);
        ctx.lineTo(-hw - 30, -hh - 140);
        ctx.lineTo(hw + 30, -hh - 140);
        ctx.lineTo(hw - 4, -hh);
        ctx.closePath();
        ctx.fill();
      }

      // 10. Taillights (Rear Glowing Red LEDs)
      ctx.fillStyle = '#ff0033';
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = isPlayer && this.player.isBraking ? 18 : 6;
      ctx.fillRect(-hw + 6, hh - 3, 8, 3);
      ctx.fillRect(hw - 14, hh - 3, 8, 3);
      ctx.shadowBlur = 0;

      // 11. AI Turn Signals
      if (turnSignal) {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10;
        if (turnSignal === 'left') {
          ctx.fillRect(-hw - 2, -hh + 4, 4, 6);
          ctx.fillRect(-hw - 2, hh - 8, 4, 6);
        } else if (turnSignal === 'right') {
          ctx.fillRect(hw - 2, -hh + 4, 4, 6);
          ctx.fillRect(hw - 2, hh - 8, 4, 6);
        }
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    },

    fillRoundedRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
    },

    drawRoadsideProp(ctx, prop, env) {
      ctx.save();
      if (prop.type === 'tree') {
        // Tree Canopy
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(prop.x + 3, prop.y + 3, prop.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = prop.color;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, prop.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(prop.x - 3, prop.y - 3, prop.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.type === 'lamp') {
        // Street Lamp Pole
        ctx.fillStyle = '#64748b';
        ctx.fillRect(prop.x - 3, prop.y - 12, 6, 24);

        // Light bulb glow
        ctx.fillStyle = '#fef08a';
        ctx.shadowColor = '#fef08a';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y - 12, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Sign / Barrier
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(prop.x - 12, prop.y - 8, 24, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(prop.x - 8, prop.y - 4, 16, 8);
      }
      ctx.restore();
    },

    drawCoin(ctx, coin) {
      ctx.save();
      ctx.translate(coin.x, coin.y);
      const scaleX = Math.cos(coin.rotation);
      ctx.scale(scaleX, 1);

      // Gold Coin Body
      ctx.fillStyle = '#ffb700';
      ctx.shadowColor = '#ffb700';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
      ctx.fill();

      // Coin Rim & Star
      ctx.strokeStyle = '#fffbeb';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);

      ctx.restore();
    },

    drawPowerup(ctx, pup) {
      ctx.save();
      ctx.translate(pup.x, pup.y);
      const scale = 1 + Math.sin(pup.pulse) * 0.15;
      ctx.scale(scale, scale);

      let color = '#00f0ff';
      let icon = '🛡️';
      if (pup.type === 'magnet') { color = '#ffb700'; icon = '🧲'; }
      if (pup.type === 'multiplier') { color = '#d946ef'; icon = '⭐'; }
      if (pup.type === 'nitro') { color = '#00ff88'; icon = '⚡'; }

      // Glowing Orb
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, pup.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 0, 1);

      ctx.restore();
    },

    /* ------------------------------------------------------------------------
       ANIMATION LOOP
       ------------------------------------------------------------------------ */
    loop(currentTime) {
      if (!this.lastTime) this.lastTime = currentTime;
      const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
      this.lastTime = currentTime;

      this.update(dt);
      this.render();

      requestAnimationFrame((t) => this.loop(t));
    }
  };

  // Boot Engine when DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    Game.init();
  });
})();
