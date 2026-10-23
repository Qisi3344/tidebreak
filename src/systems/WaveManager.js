import { buildWaves, WAVES_TOTAL, WEST_OPEN_WAVE, INTERMISSION, ECON } from '../core/config.js';

// 波次调度：spawn 排程 → 清场判定 → 波奖励 → 间歇（可提前召唤）→ 下一波 / 无尽
export class WaveManager {
  constructor() {
    this.waves = buildWaves();
    this.reset();
  }

  reset() {
    this.wave = 0;              // 已开始的波次
    this.phase = 'idle';        // idle | spawning | clearing | intermission | done
    this.timers = [];
    this.interT = 0;
    this.spawnCount = 0;
    this.endless = false;
    this.totalSpawned = 0;
  }

  get waveNum() { return this.wave; }
  get isBossWave() { return this.wave % 5 === 0; }

  // Game 注入 spawnFn(type, pathKey) 、回调
  startWave(spawnFn, onWaveStart, onWaveEnd, westOpen) {
    this.wave++;
    this.phase = 'spawning';
    this.timers = [];
    this.spawnCount = 0;

    if (westOpen && this.wave === WEST_OPEN_WAVE) westOpen();

    const def = this._waveDef(this.wave);
    for (const entry of def.entries) {
      for (let i = 0; i < entry.count; i++) {
        const t = (entry.delay || 0) + i * entry.gap;
        this.timers.push({ t, type: entry.type, fired: false });
      }
    }
    this.totalToSpawn = this.timers.length;
    if (onWaveStart) onWaveStart(this.wave, def);
  }

  _waveDef(n) {
    if (n <= WAVES_TOTAL) return this.waves[n - 1];
    // 无尽模式：确定性伪随机混编，每 5 波一个 Boss 波
    const rng = mulberry32(n * 7919);
    const entries = [];
    const p = (n - WAVES_TOTAL);
    if (n % 5 === 0) {
      entries.push({ type: 'boss', count: 2 + Math.floor(p / 3), gap: 6, delay: 1 });
    }
    entries.push({ type: 'drifter', count: 18 + p * 2, gap: Math.max(0.18, 0.4 - p * 0.01) });
    entries.push({ type: 'shelled', count: 10 + p, gap: 1.0, delay: 3 });
    if (n % 3 === 0) entries.push({ type: 'floater', count: 10 + p, gap: 0.6, delay: 5 });
    if (n % 2 === 0) entries.push({ type: 'splitter', count: 8 + p, gap: 0.8, delay: 7 });
    return { entries, reward: 100 + p * 20 };
  }

  // 每帧：dt、spawn 回调、场上敌人数、波结束回调
  update(dt, spawnFn, aliveEnemies, onWaveEnd) {
    if (this.phase === 'spawning') {
      let allFired = true;
      for (const tm of this.timers) {
        if (tm.fired) continue;
        tm.t -= dt;
        if (tm.t <= 0) {
          tm.fired = true;
          // 裂隙分配：10 波后交替，boss 只走主裂隙
          let pathKey = 'main';
          if (this.wave >= WEST_OPEN_WAVE && tm.type !== 'boss') {
            pathKey = (this.spawnCount % 2 === 0) ? 'main' : 'west';
          }
          spawnFn(tm.type, pathKey);
          this.spawnCount++;
          this.totalSpawned++;
        } else {
          allFired = false;
        }
      }
      if (allFired) this.phase = 'clearing';
    } else if (this.phase === 'clearing') {
      if (aliveEnemies === 0) {
        this.phase = 'intermission';
        this.interT = INTERMISSION;
        if (onWaveEnd) onWaveEnd(this.wave, this._waveDef(this.wave).reward);
      }
    } else if (this.phase === 'intermission') {
      this.interT -= dt;
      if (this.interT <= 0) this.phase = 'ready'; // 由 Game 决定何时 startWave
    }
  }

  // 提前召唤：返回利息奖励
  callEarly() {
    if (this.phase !== 'intermission') return 0;
    const bonus = ECON.earlyBonus + Math.ceil(this.interT);
    this.phase = 'ready';
    return bonus;
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
