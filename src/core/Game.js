import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager.js';
import { World } from '../scene/World.js';
import { EnemyPool } from '../entities/Enemy.js';
import { Tower } from '../entities/Tower.js';
import { ProjectilePool } from '../entities/Projectile.js';
import { Hero } from '../entities/Hero.js';
import { WaveManager } from '../systems/WaveManager.js';
import { Economy } from '../systems/Economy.js';
import { SpatialGrid } from '../systems/Collision.js';
import { Effects } from '../systems/Effects.js';
import { AudioFX } from '../audio/Audio.js';
import { UI } from '../ui/UI.js';
import { MAP, PATH_MAIN, PATH_WEST, ENEMIES, HERO, TOWERS, WAVES_TOTAL, ECON } from './config.js';

// 游戏主控：状态机 + 主循环 + 输入 + 系统接线
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', LEVELUP: 'levelup', RESULT: 'result' };

export class Game {
  constructor(container) {
    this.sm = new SceneManager(container);
    this.world = new World(this.sm.scene);
    this.enemies = new EnemyPool(this.sm.scene);
    this.projectiles = new ProjectilePool(this.sm.scene);
    this.hero = new Hero(this.sm.scene);
    this.waves = new WaveManager();
    this.economy = new Economy(null);
    this.grid = new SpatialGrid(2.5);
    this.fx = new Effects(this.sm.scene);
    this.audio = new AudioFX();
    this.ui = new UI();

    this.towers = [];
    this.state = STATE.MENU;
    this.coreHp = MAP.coreHp;
    this.coreMax = MAP.coreHp;
    this.globalDmgMul = 1;   // 潮核充能：每守住一个 Boss 波全塔 +15%
    this.time = 0;
    this.shake = 0;
    this._qbuf = [];
    this._shootSfxT = 0;

    this.projectiles.onHit = (target, p) => this._onProjectileHit(target, p);
    this._bindUI();
    this._bindInput();
    this._setupProjectilesForMenu();

    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupProjectilesForMenu() { /* 菜单时仅渲染场景 */ }

  // ================= UI 回调 =================
  _bindUI() {
    this.ui.onStart = () => this.startGame();
    this.ui.onRestart = () => this.startGame();
    this.ui.onEndless = () => this._continueEndless();
    this.ui.onCallEarly = () => this._callEarly();
    this.ui.btnResume.onclick = () => this._togglePause();
    this.ui.btnRestart1.onclick = () => this.startGame();
    this.ui.onResume = null;
  }

  // ================= 输入 =================
  _bindInput() {
    const canvas = this.sm.renderer.domElement;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) this._togglePause();
        return;
      }
      if (this.state !== STATE.PLAYING) return;
      this.hero.setKey(e.code, true);
      if (e.code === 'KeyQ') this.hero.trySkillQ(this);
      if (e.code === 'KeyE') this.hero.trySkillE(this);
      if (e.code === 'KeyN') this._callEarly();
    });
    window.addEventListener('keyup', (e) => this.hero.setKey(e.code, false));
    window.addEventListener('blur', () => { this.hero.keys = {}; this.hero.mouseDown = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (this.state !== STATE.PLAYING) return;
      if (e.button === 0) this.hero.setFiring(true);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.hero.setFiring(false);
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.state === STATE.PLAYING) this._onRightClick(e);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.sm.zoom(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    canvas.addEventListener('mousemove', (e) => {
      if (this.state !== STATE.PLAYING) return;
      this._mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 };
    });
  }

  _groundPoint(ndcX, ndcY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.sm.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, pt) ? pt : null;
  }

  _hoverCell() {
    if (!this._mouse) return null;
    const pt = this._groundPoint(this._mouse.x, this._mouse.y);
    if (!pt) return null;
    const { gx, gz } = this.world.worldToGrid(pt.x, pt.z);
    if (!this.world.inBounds(gx, gz)) return null;
    return { gx, gz };
  }

  _onRightClick() {
    const cell = this._hoverCell();
    if (!cell) { this.ui.hideBuild(); this.ui.hideTowerMenu(); return; }
    const tower = this.world.towerAt(cell.gx, cell.gz);
    if (tower) {
      this._selectedTower = tower;
      this.ui.hideBuild();
      this.ui.showTowerMenu(tower, this.economy.gold,
        () => this._upgradeTower(tower),
        () => this._sellTower(tower));
      this.world.showRange(tower.pos.x, tower.pos.z, tower.stats.range, tower.def.color);
    } else if (this.world.canBuild(cell.gx, cell.gz)) {
      this._buildCell = cell;
      this.ui.hideTowerMenu();
      this.ui.showBuild(this.economy.gold,
        (type) => this._buildTower(type),
        () => { this.ui.hideBuild(); });
      this.audio.click();
    } else {
      this.ui.hideBuild(); this.ui.hideTowerMenu(); this.world.hideRange();
    }
  }

  // ================= 建造 =================
  _buildTower(type) {
    const cell = this._buildCell;
    if (!cell || !this.world.canBuild(cell.gx, cell.gz)) return;
    const cost = TOWER_COST(type, 0);
    if (!this.economy.spend(cost)) { this.ui.showToast('赏金不足'); this.audio.deny(); return; }
    const t = new Tower(this.sm.scene, type, cell.gx, cell.gz, this.world);
    this.towers.push(t);
    this.economy.built++;
    this.world.occupy(cell.gx, cell.gz, t);
    this.fx.burst(t.pos.x, 0.8, t.pos.z, t.def.color, { count: 16, speed: 3, life: 0.5, up: 3 });
    this.fx.ring(t.pos.x, t.pos.z, t.def.color, 1.6, 0.4);
    this.audio.build();
    this.ui.hideBuild();
  }
  _upgradeTower(t) {
    if (t.maxLevel || !this.economy.spend(t.upgradeCost)) { this.audio.deny(); return; }
    t.upgrade();
    this.fx.burst(t.pos.x, 1.2, t.pos.z, t.def.color, { count: 20, speed: 4, life: 0.6, up: 4 });
    this.audio.upgrade();
    this.ui.hideTowerMenu();
    this.world.showRange(t.pos.x, t.pos.z, t.stats.range, t.def.color);
  }
  _sellTower(t) {
    this.economy.gain(t.sellValue);
    t.dispose(this.world);
    this.towers = this.towers.filter(x => x !== t);
    this.fx.burst(t.pos.x, 0.8, t.pos.z, 0x8899aa, { count: 10, speed: 2.5, life: 0.4, up: 2 });
    this.audio.sell();
    this.ui.hideTowerMenu();
    this.world.hideRange();
  }

  // ================= 流程 =================
  startGame() {
    this.audio.init();
    // 清场
    for (const t of this.towers) t.dispose(this.world);
    this.towers = [];
    this.enemies.clear();
    this.projectiles.clear();
    this.hero.reset();
    this.economy.reset();
    this.waves.reset();
    this.ui.clearFloats();
    this.coreHp = MAP.coreHp;
    this.globalDmgMul = 1;
    this.shake = 0;

    this.state = STATE.PLAYING;
    this.time = 0;
    this.ui.showMenu(false);
    this.ui.showPause(false);
    this.ui.showResult(false);
    this.ui.hideLevelup();
    this.ui.hideBuild();
    this.ui.hideTowerMenu();
    this.world.hideRange();
    this.ui.showHUD(true);
    this.waves.phase = 'intermission';
    this.waves.interT = 8;
    this.ui.setHUD({ wave: 0, gold: this.economy.gold, score: 0, enemies: 0, coreRatio: 1, heroLv: 1, heroXp: 0 });
    this.ui.showBanner('守 潮 开 始', '点击右键建造防御塔 · Q / E 释放技能');
  }

  _togglePause() {
    if (this.state === STATE.PLAYING) {
      this.state = STATE.PAUSED;
      this.ui.showPause(true);
    } else if (this.state === STATE.PAUSED) {
      this.state = STATE.PLAYING;
      this.ui.showPause(false);
    }
  }

  _callEarly() {
    const bonus = this.waves.callEarly();
    if (bonus > 0) {
      this.economy.gain(bonus);
      this.economy.addScore(bonus);
      this.ui.floatText(this.world.corePos, `+◈${bonus} 提前召唤`, '#7fffd4');
      this.audio.click();
    }
  }

  _continueEndless() {
    this.waves.endless = true;
    this.state = STATE.PLAYING;
    this.ui.showResult(false);
    this.ui.showHUD(true);
    this.waves.phase = 'intermission';
    this.waves.interT = 12;
    this.ui.showBanner('无 尽 潮 汐', '它们不会停止涌来', 2.6);
  }

  _victory() {
    this.state = STATE.RESULT;
    this.audio.win();
    this.ui.showHUD(false);
    const finalScore = this.economy.score + this.coreHp * ECON.coreHpScore;
    const hs = this._saveHiscore(finalScore);
    this.ui.setResult(true, {
      wave: this.waves.wave, score: finalScore,
      kills: this.economy.kills, built: this.economy.built,
      coreHp: this.coreHp, coreMax: this.coreMax, endless: this.waves.endless,
      hiscore: hs, time: this.time,
    });
    this.economy.addScore(this.coreHp * ECON.coreHpScore);
  }

  _defeat() {
    this.state = STATE.RESULT;
    this.audio.lose();
    this.ui.showHUD(false);
    const hs = this._saveHiscore(this.economy.score);
    this.ui.setResult(false, {
      wave: this.waves.wave, score: this.economy.score,
      kills: this.economy.kills, built: this.economy.built,
      coreHp: 0, coreMax: this.coreMax, endless: this.waves.endless,
      hiscore: hs, time: this.time,
    });
  }

  _saveHiscore(score) {
    try {
      const prev = parseInt(localStorage.getItem('tidebreak_hiscore') || '0', 10);
      if (score > prev) {
        localStorage.setItem('tidebreak_hiscore', String(Math.floor(score)));
        return Math.floor(score);
      }
      return prev;
    } catch { return Math.floor(score); }
  }

  // ================= 敌人生成 =================
  _spawnEnemy(type, pathKey) {
    const path = pathKey === 'west' ? PATH_WEST : PATH_MAIN;
    const e = this.enemies.spawn(
      type, this.waves.wave, path,
      (en) => this._onEnemyDeath(en),
      (en) => this._onLeak(en),
      (boss) => this._onBossSummon(boss, pathKey)
    );
    if (!e) return;
    if (e.flying) {
      // 悬浮者从裂隙直线飞向潮核，起点加随机散布
      const rift = pathKey === 'west' ? { x: -22, z: 12 } : { x: 22, z: -14 };
      e.pos.set(rift.x + (Math.random() - 0.5) * 3, 0, rift.z + (Math.random() - 0.5) * 3);
      e.currentModel.grp.position.copy(e.pos);
    }
    if (ENEMIES[type].boss) {
      this.audio.bossWarn();
      this.ui.showBanner('⚠ 巨 兽 来 袭', '潮汐巨兽 正在逼近', 2.6);
      this.fx.ring(e.pos.x, e.pos.z, 0xff2d55, 6, 1.2);
      this.shake = Math.max(this.shake, 0.5);
    }
  }

  _onBossSummon(boss, pathKey) {
    const path = pathKey === 'west' ? PATH_WEST : PATH_MAIN;
    for (let i = 0; i < 2; i++) {
      const e = this.enemies.spawn('drifter', this.waves.wave, path,
        (en) => this._onEnemyDeath(en), (en) => this._onLeak(en), null);
      if (e) {
        e.pos.set(boss.pos.x + (Math.random() - 0.5) * 2.5, 0, boss.pos.z + (Math.random() - 0.5) * 2.5);
        e.wpIndex = boss.wpIndex;
        e.currentModel.grp.position.copy(e.pos);
      }
    }
    this.fx.burst(boss.pos.x, 1.5, boss.pos.z, 0xff2d55, { count: 18, speed: 5, life: 0.5 });
    this.audio.explodeBig();
  }

  _onEnemyDeath(en) {
    const def = en.def;
    this.economy.addKill(def.bounty, def.score, this.waves.wave);
    this.hero.gainXp(Math.ceil(def.score * 0.5));
    const big = def.boss || en.type === 'shelled';
    this.fx.burst(en.pos.x, en.hitY, en.pos.z, def.color, {
      count: def.boss ? 60 : big ? 22 : 12,
      speed: def.boss ? 9 : 5, life: def.boss ? 1.1 : 0.6, size: def.boss ? 0.9 : 0.5, up: def.boss ? 5 : 2.5,
    });
    if (def.boss) {
      this.fx.ring(en.pos.x, en.pos.z, def.color, 7, 0.9);
      this.audio.explodeBig();
      this.shake = Math.max(this.shake, 0.6);
      this.ui.floatText(en.pos.clone().setY(2), `巨兽陨落 +◈${def.bounty}`, '#ff9db4', 18);
    } else {
      big ? this.audio.killSmall() : this.audio.hit();
    }
    this.ui.floatText(en.pos.clone().setY(en.hitY), `+◈${def.bounty}`, '#ffd166', 13);
    // 裂殖体分裂
    if (def.splitInto) {
      for (let i = 0; i < def.splitCount; i++) {
        const path = en.waypoints;
        const child = this.enemies.spawn(def.splitInto, this.waves.wave, path,
          (x) => this._onEnemyDeath(x), (x) => this._onLeak(x), null);
        if (child) {
          child.pos.set(en.pos.x + (Math.random() - 0.5) * 1.6, 0, en.pos.z + (Math.random() - 0.5) * 1.6);
          child.wpIndex = en.wpIndex;
          child.currentModel.grp.position.copy(child.pos);
        }
      }
      this.fx.burst(en.pos.x, 0.6, en.pos.z, def.color, { count: 10, speed: 4, life: 0.4 });
    }
    // 升级检查延后到主循环处理（同一帧多杀排队）
  }

  _onLeak(en) {
    const dmg = en.def.boss ? 5 : 1;
    this.coreHp -= dmg;
    this.economy.leaks++;
    this.world.coreFlash();
    this.shake = Math.max(this.shake, 0.35);
    this.audio.leak();
    this.fx.burst(0, 1.5, 16, 0xff5050, { count: 14, speed: 4, life: 0.5 });
    this.ui.floatText(this.world.corePos.clone().setY(3), `-${dmg} 潮核`, '#ff5050', 16);
    if (this.coreHp <= 0) {
      this.coreHp = 0;
      this._defeat();
    }
  }

  // ================= 弹道命中 =================
  _onProjectileHit(target, p) {
    if (p.aoe) {
      const hit = this.queryEnemies(p.mesh.position.x, p.mesh.position.z, p.aoe, []);
      for (const e of hit) {
        if (e.flying) continue;
        e.damage(p.dmg);
      }
      this.fx.burst(p.mesh.position.x, 0.5, p.mesh.position.z, p.color, { count: 16, speed: 5, life: 0.5, size: 0.7, up: 3 });
      this.fx.ring(p.mesh.position.x, p.mesh.position.z, p.color, p.aoe, 0.45);
      this.audio.hit();
    } else {
      target.damage(p.dmg);
      this.fx.burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, p.color, { count: 5, speed: 2.5, life: 0.3, size: 0.4, up: 1 });
      this.audio.hit();
    }
  }

  // ================= 供实体调用的接口 =================
  queryEnemies(x, z, r, out) { return this.grid.queryCircle(x, z, r + 1.2, out); }
  spawnProjectile(pos, spec) { this.projectiles.spawn(pos, spec); }

  pickNearestEnemy(x, z, maxR) {
    let best = null, bd = maxR * maxR;
    for (const e of this.enemies.active) {
      if (!e.alive) continue;
      const d = (e.pos.x - x) ** 2 + (e.pos.z - z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  onHeroShoot(muzzle) {
    this._shootSfxT++;
    if (this._shootSfxT % 2 === 1) this.audio.heroShoot();
    this.fx.burst(muzzle.x, muzzle.y, muzzle.z, 0x9ff5ff, { count: 2, speed: 1, life: 0.12, size: 0.35, up: 0.4, gravity: 0 });
  }
  onTowerShoot(t, muzzle) {
    if (t.type === 'longbow') this.audio.snipe();
    this.fx.burst(muzzle.x, muzzle.y, muzzle.z, t.def.color, { count: 3, speed: 1.5, life: 0.15, size: 0.4, up: 0.3, gravity: 0 });
  }
  onFrostPulse(pos, aoe) {
    this.fx.ring(pos.x, pos.z, 0x8ab6ff, aoe, 0.5);
    this.fx.burst(pos.x, 1.3, pos.z, 0x8ab6ff, { count: 8, speed: 2, life: 0.5, size: 0.4, up: 1.5, gravity: 1 });
    this.audio.frost();
  }
  onNovaBlast(at, radius) {
    this.fx.burst(at.x, 0.8, at.z, 0x35e0ff, { count: 40, speed: 9, life: 0.7, size: 0.8, up: 4 });
    this.fx.burst(at.x, 0.5, at.z, 0xff5ad1, { count: 20, speed: 6, life: 0.9, size: 0.6, up: 2 });
    this.fx.ring(at.x, at.z, 0x35e0ff, radius, 0.6);
    this.audio.nova();
    this.shake = Math.max(this.shake, 0.3);
  }
  onStasisField(at, radius) {
    this.fx.ring(at.x, at.z, 0x8ab6ff, radius, 0.8);
    this.audio.stasis();
  }

  // ================= 主循环 =================
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === STATE.PLAYING) this._updatePlaying(dt);
    else if (this.state === STATE.MENU) this.world.update(dt, this.sm.camera);

    // 相机震动
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.4);
      this.sm.camera.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.sm.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
    }

    this.sm.render(dt);
  }

  _updatePlaying(dt) {
    this.time += dt;

    // 瞄准 & 悬停格
    if (this._mouse) {
      const pt = this._groundPoint(this._mouse.x, this._mouse.y);
      if (pt) this.hero.setAim(pt);
    }
    const cell = this._hoverCell();
    if (cell && !this.world.towerAt(cell.gx, cell.gz)) {
      this.world.setHoverTile(cell.gx, cell.gz, this.world.canBuild(cell.gx, cell.gz));
    } else {
      this.world.setHoverTile(null);
    }

    // 重建空间网格
    this.grid.clear();
    for (const e of this.enemies.active) this.grid.insert(e);

    // 系统更新
    this.hero.update(dt, this);
    this.enemies.update(dt, this.sm.camera, this);
    for (const t of this.towers) t.update(dt, this.grid, this);
    this.projectiles.update(dt, this.grid, this.enemies.active);

    // 波次
    this.waves.update(dt,
      (type, pathKey) => this._spawnEnemy(type, pathKey),
      this.enemies.active.length,
      (waveNum, reward) => {
        this.economy.gain(reward);
        this.economy.addScore(reward);
        this.ui.floatText(this.world.corePos.clone().setY(3), `第 ${waveNum} 波守住 +◈${reward}`, '#7fffd4', 16);
        // 潮核充能：守住 Boss 波，全塔伤害永久提升
        if (waveNum % 5 === 0) {
          this.globalDmgMul *= 1.18;
          this.ui.showBanner('潮 核 充 能', `全塔伤害提升至 ${Math.round(this.globalDmgMul * 100)}%`, 2.4);
          this.audio.upgrade();
          this.fx.ring(0, 16, 0xffd27a, 9, 1.0);
          this.fx.burst(0, 2, 16, 0xffd27a, { count: 40, speed: 7, life: 1.0, up: 6 });
        }
        if (waveNum >= WAVES_TOTAL && !this.waves.endless) { this._victory(); return; }
        this.ui.showBanner(`第 ${waveNum} 波 · 已守住`, `波次奖励 +◈${reward}`, 1.8);
      });

    // intermission / ready → 自动开下一波
    if (this.waves.phase === 'intermission') {
      this.ui.setIntermission(this.waves.interT);
    } else if (this.waves.phase === 'ready') {
      this.ui.setIntermission(null);
      this.waves.startWave(
        (type, pathKey) => this._spawnEnemy(type, pathKey),
        (n, def) => {
          const boss = def.entries.some(x => x.type === 'boss');
          this.ui.showBanner(`第 ${n} 波`, n >= WAVES_TOTAL ? '' : boss ? '巨兽正在逼近' : '裂隙泛起涟漪', 2);
          this.audio.waveStart();
          if (n === WAVES_TOTAL + 1) this.ui.showBanner('无 尽 潮 汐', '第 ' + n + ' 波', 2.4);
        },
        null,
        () => { this.world.openWest(); this.ui.showBanner('西 裂 隙 开 启', '敌军将两路进攻！', 3); this.audio.bossWarn(); }
      );
    }

    // 升级三选一（暂停游戏）
    if (this.hero.pendingLevelUps > 0 && this.state === STATE.PLAYING && this.waves.phase !== 'done') {
      this.state = STATE.LEVELUP;
      this.audio.levelUp();
      this._offerLevelUp();
    }

    // 世界 & 特效
    this.world.update(dt, this.sm.camera);
    this.fx.update(dt);

    // Boss 血条
    const bosses = this.enemies.active.filter(e => e.alive && e.def.boss);
    if (bosses.length) {
      const hp = bosses.reduce((s, e) => s + e.hp, 0);
      const max = bosses.reduce((s, e) => s + e.maxHp, 0);
      this.ui.setBossHp(hp / max);
    } else {
      this.ui.setBossHp(null);
    }

    // UI 刷新
    this.ui.setHUD({
      wave: this.waves.wave, gold: this.economy.gold, score: this.economy.score,
      enemies: this.enemies.active.length, coreRatio: this.coreHp / this.coreMax,
      heroLv: this.hero.level, heroXp: this.hero.xp / this.hero.xpNeed,
    });
    const cdQ = HERO.skillQ.cd * this.hero.cdMult;
    const cdE = HERO.skillE.cd * this.hero.cdMult;
    this.ui.setSkillCd('Q', this.hero.cdQ / cdQ, Math.ceil(this.hero.cdQ));
    this.ui.setSkillCd('E', this.hero.cdE / cdE, Math.ceil(this.hero.cdE));
    this.ui.updateFloats(dt, this.sm.camera, window.innerWidth, window.innerHeight);
  }

  _offerLevelUp() {
    this.hero.pendingLevelUps--;
    const pool = HERO.upgrades;
    const picks = [];
    const idxs = pool.map((_, i) => i);
    while (picks.length < 3 && idxs.length) {
      picks.push(idxs.splice((Math.random() * idxs.length) | 0, 1)[0]);
    }
    this.ui.showLevelUp(picks.map(i => pool[i]), (id) => {
      this.hero.applyUpgrade(id);
      this.ui.hideLevelup();
      this.audio.upgrade();
      this.fx.burst(this.hero.pos.x, 1.2, this.hero.pos.z, 0xffb347, { count: 24, speed: 4, life: 0.8, up: 5 });
      // 已进入结算/暂停等其他状态时不再回到 playing
      if (this.state !== STATE.LEVELUP) return;
      if (this.hero.pendingLevelUps > 0) {
        this.state = STATE.PLAYING;
        // 下一帧再弹
        setTimeout(() => { if (this.state === STATE.PLAYING) { this.state = STATE.LEVELUP; this._offerLevelUp(); } }, 60);
      } else {
        this.state = STATE.PLAYING;
      }
    });
  }
}

// 塔首级造价快捷取
function TOWER_COST(type, level) { return TOWERS[type].levels[level].cost; }
