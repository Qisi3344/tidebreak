// WebAudio 全程序化音效 + 环境 BGM（零音频文件）
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmOn = true;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 8;
    this.master.connect(comp).connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);
    this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = 0.32;
    this.bgmBus.connect(this.master);

    // 噪声缓冲
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._startBgm();
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.master) this.master.gain.value = v ? 0.5 : 0;
  }

  // ---------- 基元 ----------
  _tone({ freq = 440, freqEnd, type = 'sine', dur = 0.15, vol = 0.3, when = 0, bus } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noise({ dur = 0.2, vol = 0.3, filterFrom = 4000, filterTo = 400, when = 0 } = {}) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFrom, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(filterTo, 20), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // ---------- 游戏音效（高频音效全局节流防叠爆）----------
  _thr(name, ms) {
    const now = performance.now();
    if (!this._thrMap) this._thrMap = {};
    if (this._thrMap[name] && now - this._thrMap[name] < ms) return false;
    this._thrMap[name] = now;
    return true;
  }
  heroShoot() { if (this._thr('hs', 90)) this._tone({ freq: 1400, freqEnd: 900, type: 'triangle', dur: 0.06, vol: 0.12 }); }
  towerShoot() { if (this._thr('ts', 80)) this._tone({ freq: 700, freqEnd: 500, type: 'square', dur: 0.05, vol: 0.08 }); }
  snipe() { if (this._thr('sn', 200)) { this._tone({ freq: 300, freqEnd: 90, type: 'sawtooth', dur: 0.18, vol: 0.2 }); this._noise({ dur: 0.1, vol: 0.12, filterFrom: 6000, filterTo: 800 }); } }
  hit() { if (this._thr('ht', 70)) this._noise({ dur: 0.05, vol: 0.1, filterFrom: 5000, filterTo: 1500 }); }
  killSmall() { if (this._thr('ks', 90)) { this._noise({ dur: 0.18, vol: 0.2, filterFrom: 3000, filterTo: 200 }); this._tone({ freq: 320, freqEnd: 70, type: 'sine', dur: 0.2, vol: 0.22 }); } }
  explodeBig() {
    this._noise({ dur: 0.5, vol: 0.35, filterFrom: 2400, filterTo: 60 });
    this._tone({ freq: 130, freqEnd: 32, type: 'sine', dur: 0.55, vol: 0.4 });
    this._tone({ freq: 65, freqEnd: 28, type: 'triangle', dur: 0.6, vol: 0.3, when: 0.03 });
  }
  build() { [440, 554, 659].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.1, vol: 0.18, when: i * 0.06 })); }
  upgrade() { [523, 659, 784, 1046].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 0.12, vol: 0.2, when: i * 0.05 })); }
  sell() { [600, 400].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.1, vol: 0.15, when: i * 0.07 })); }
  frost() { this._tone({ freq: 1800, freqEnd: 600, type: 'sine', dur: 0.25, vol: 0.1 }); this._tone({ freq: 2400, freqEnd: 900, type: 'sine', dur: 0.2, vol: 0.06, when: 0.03 }); }
  nova() {
    this._noise({ dur: 0.4, vol: 0.3, filterFrom: 5000, filterTo: 100 });
    this._tone({ freq: 220, freqEnd: 40, type: 'sawtooth', dur: 0.5, vol: 0.3 });
  }
  stasis() { this._tone({ freq: 1200, freqEnd: 400, type: 'sine', dur: 0.5, vol: 0.15 }); this._tone({ freq: 1210, freqEnd: 410, type: 'sine', dur: 0.5, vol: 0.12 }); }
  leak() { this._tone({ freq: 180, freqEnd: 50, type: 'square', dur: 0.3, vol: 0.3 }); this._noise({ dur: 0.25, vol: 0.2, filterFrom: 1000, filterTo: 100 }); }
  waveStart() { [880, 660, 880, 660].forEach((f, i) => this._tone({ freq: f, type: 'square', dur: 0.12, vol: 0.14, when: i * 0.14 })); }
  bossWarn() {
    [110, 110, 87, 87].forEach((f, i) => this._tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.26, when: i * 0.32 }));
    this._tone({ freq: 55, type: 'sine', dur: 1.4, vol: 0.22 });
  }
  levelUp() { [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone({ freq: f, type: 'sine', dur: 0.15, vol: 0.22, when: i * 0.07 })); }
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.24, when: i * 0.16 })); }
  lose() { [440, 392, 349, 262].forEach((f, i) => this._tone({ freq: f, type: 'sawtooth', dur: 0.4, vol: 0.2, when: i * 0.28 })); this._tone({ freq: 55, freqEnd: 30, type: 'sine', dur: 1.6, vol: 0.3, when: 0.2 }); }
  click() { this._tone({ freq: 2000, type: 'sine', dur: 0.04, vol: 0.1 }); }
  deny() { this._tone({ freq: 220, freqEnd: 160, type: 'square', dur: 0.12, vol: 0.16 }); }

  // ---------- BGM：低音 drone + 五声琶音 ----------
  _startBgm() {
    if (!this.bgmOn) return;
    const ctx = this.ctx;
    // drone
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.14;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    droneGain.connect(lp).connect(this.bgmBus);
    [55, 55.6, 82.5].forEach(f => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(droneGain); o.start();
    });
    // 琶音 pattern（A 小调五声）
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    const pattern = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 6, 5, 4, 2, 0];
    const stepDur = 0.32;
    let step = 0;
    let nextT = ctx.currentTime + 0.2;
    this._bgmTimer = setInterval(() => {
      if (!this.ctx || !this.enabled) return;
      while (nextT < ctx.currentTime + 0.6) {
        const idx = pattern[step % pattern.length];
        const t0 = nextT;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = scale[idx];
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.10, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 0.9);
        o.connect(g).connect(this.bgmBus);
        o.start(t0); o.stop(t0 + stepDur);
        // 每四步一个低八度垫音
        if (step % 4 === 0) {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.type = 'triangle'; o2.frequency.value = scale[idx] / 2;
          g2.gain.setValueAtTime(0, t0);
          g2.gain.linearRampToValueAtTime(0.08, t0 + 0.05);
          g2.gain.exponentialRampToValueAtTime(0.0001, t0 + stepDur * 1.8);
          o2.connect(g2).connect(this.bgmBus);
          o2.start(t0); o2.stop(t0 + stepDur * 2);
        }
        step++; nextT += stepDur;
      }
    }, 200);
  }
}
