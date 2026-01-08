class BeatMaker {
    constructor() {
        this.tracks = ['kick', 'snare', 'hihat', 'crash'];
        this.steps = 16;
        this.currentStep = 0;
        this.isPlaying = false;
        this.tempo = 120;
        this.intervalId = null;

        this.pattern = {};
        this.tracks.forEach(track => {
            this.pattern[track] = new Array(this.steps).fill(false);
        });

        this.mutedTracks = new Set();

        this.audioContext = null;
        this.initAudioContext();

        this.soundConfig = {
            kick: { frequency: 60, type: 'sine', decay: 0.5 },
            snare: { frequency: 200, type: 'square', decay: 0.3 },
            hihat: { frequency: 8000, type: 'square', decay: 0.1 },
            crash: { frequency: 300, type: 'sawtooth', decay: 1.0 }
        };

        this.initializeDOM();
        this.setupEventListeners();
        this.generateSteps();
    }

    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.error('Web Audio API not supported:', error);
        }
    }

    initializeDOM() {
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.tempoSlider = document.getElementById('tempoSlider');
        this.tempoValue = document.getElementById('tempoValue');
        this.muteButtons = document.querySelectorAll('.mute-btn');
        this.soundSelects = document.querySelectorAll('.sound-select');
        this.visualizerBars = document.querySelectorAll('.viz-bar');
    }

    setupEventListeners() {
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.clearBtn.addEventListener('click', () => this.clearAll());

        this.tempoSlider.addEventListener('input', (e) => this.updateTempo(e.target.value));

        this.muteButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleMute(e.currentTarget.dataset.track));
        });

        this.soundSelects.forEach(select => {
            select.addEventListener('change', (e) => this.changeSound(e.target.dataset.track, e.target.value));
        });

        document.addEventListener('click', () => {
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        }, { once: true });
    }

    generateSteps() {
        this.tracks.forEach(trackName => {
            const stepsContainer = document.querySelector(`[data-sound="${trackName}"]`);
            stepsContainer.innerHTML = '';

            for (let i = 0; i < this.steps; i++) {
                const stepBtn = document.createElement('button');
                stepBtn.className = 'step';
                stepBtn.dataset.track = trackName;
                stepBtn.dataset.step = i;
                stepBtn.setAttribute('aria-label', `${trackName} step ${i + 1}`);

                stepBtn.addEventListener('click', () => this.toggleStep(trackName, i));

                stepsContainer.appendChild(stepBtn);
            }
        });
    }

    toggleStep(track, step) {
        this.pattern[track][step] = !this.pattern[track][step];
        const stepBtn = document.querySelector(`[data-track="${track}"][data-step="${step}"]`);
        stepBtn.classList.toggle('active', this.pattern[track][step]);

        if (this.pattern[track][step]) {
            this.playSound(track);
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        this.playBtn.classList.add('playing');
        this.playBtn.querySelector('i').className = 'fas fa-pause';

        const interval = (60000 / this.tempo) / 4;

        this.intervalId = setInterval(() => {
            this.playStep();
        }, interval);
    }

    pause() {
        this.isPlaying = false;
        this.playBtn.classList.remove('playing');
        this.playBtn.querySelector('i').className = 'fas fa-play';

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.clearCurrentStepHighlight();
    }

    stop() {
        this.pause();
        this.currentStep = 0;
    }

    playStep() {
        this.clearCurrentStepHighlight();

        this.tracks.forEach(track => {
            const stepBtn = document.querySelector(`[data-track="${track}"][data-step="${this.currentStep}"]`);
            stepBtn.classList.add('current');

            if (this.pattern[track][this.currentStep] && !this.mutedTracks.has(track)) {
                this.playSound(track);
                stepBtn.classList.add('playing');
                setTimeout(() => stepBtn.classList.remove('playing'), 200);

                this.animateVisualizer(track);
            }
        });

        this.currentStep = (this.currentStep + 1) % this.steps;
    }

    clearCurrentStepHighlight() {
        document.querySelectorAll('.step.current').forEach(step => {
            step.classList.remove('current');
        });
    }

    playSound(track) {
        if (!this.audioContext) return;

        const config = this.soundConfig[track];
        if (!config) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        const filterNode = this.audioContext.createBiquadFilter();

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = config.frequency;
        oscillator.type = config.type;

        if (track === 'kick') {
            filterNode.type = 'lowpass';
            filterNode.frequency.value = 100;
        } else if (track === 'hihat') {
            filterNode.type = 'highpass';
            filterNode.frequency.value = 5000;
        }

        const now = this.audioContext.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + config.decay);

        oscillator.start(now);
        oscillator.stop(now + config.decay);
    }

    animateVisualizer(track) {
        const bar = document.querySelector(`.viz-bar[data-track="${track}"]`);
        if (bar) {
            bar.classList.add('active');
            const randomHeight = Math.random() * 40 + 20;
            bar.style.height = `${randomHeight}px`;

            setTimeout(() => {
                bar.classList.remove('active');
                bar.style.height = '8px';
            }, 150);
        }
    }

    toggleMute(track) {
        const muteBtn = document.querySelector(`.mute-btn[data-track="${track}"]`);

        if (this.mutedTracks.has(track)) {
            this.mutedTracks.delete(track);
            muteBtn.classList.remove('muted');
        } else {
            this.mutedTracks.add(track);
            muteBtn.classList.add('muted');
        }
    }

    changeSound(track, soundId) {
        const variations = {
            kick1: { frequency: 60, type: 'sine' },
            kick2: { frequency: 40, type: 'triangle' },
            kick3: { frequency: 80, type: 'square' },
            snare1: { frequency: 200, type: 'square' },
            snare2: { frequency: 300, type: 'sawtooth' },
            snare3: { frequency: 150, type: 'triangle' },
            hihat1: { frequency: 8000, type: 'square' },
            hihat2: { frequency: 10000, type: 'sawtooth' },
            hihat3: { frequency: 6000, type: 'triangle' },
            crash1: { frequency: 300, type: 'sawtooth' },
            crash2: { frequency: 400, type: 'square' }
        };

        if (variations[soundId]) {
            this.soundConfig[track] = { ...this.soundConfig[track], ...variations[soundId] };
        }
    }

    updateTempo(newTempo) {
        this.tempo = parseInt(newTempo);
        this.tempoValue.textContent = this.tempo;

        if (this.isPlaying) {
            clearInterval(this.intervalId);
            const interval = (60000 / this.tempo) / 4;
            this.intervalId = setInterval(() => {
                this.playStep();
            }, interval);
        }
    }

    clearAll() {
        this.tracks.forEach(track => {
            this.pattern[track].fill(false);
        });

        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });

        this.stop();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const beatMaker = new BeatMaker();

    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                beatMaker.togglePlay();
                break;
            case 'Escape':
                beatMaker.stop();
                break;
            case 'Delete':
            case 'Backspace':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    beatMaker.clearAll();
                }
                break;
        }
    });

    window.beatMaker = beatMaker;
});
