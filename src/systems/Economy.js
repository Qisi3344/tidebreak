import { ECON } from '../core/config.js';

// 经济与计分
export class Economy {
  constructor(onChange) {
    this.onChange = onChange;
    this.reset();
  }
  reset() {
    this.gold = ECON.startGold;
    this.score = 0;
    this.kills = 0;
    this.built = 0;
    this.leaks = 0;
    this._emit();
  }
  _emit() { if (this.onChange) this.onChange(this); }
  canAfford(v) { return this.gold >= v; }
  spend(v) {
    if (this.gold < v) return false;
    this.gold -= v; this._emit(); return true;
  }
  gain(v) { this.gold += v; this._emit(); }
  addKill(bounty, score, wave) {
    this.gold += bounty;
    this.score += Math.round(score * (1 + wave * 0.04));
    this.kills++;
    this._emit();
  }
  addScore(v) { this.score += v; this._emit(); }
}
