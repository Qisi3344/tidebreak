import * as THREE from 'three';
import { ENEMIES, hpScale, speedScale } from '../core/config.js';

// 敌人：池化复用，程序化建模，5 种 + Boss 技能
// Boss 技能（按波次轮转）：frenzy 狂潮加速 / summon 裂地召唤 / shield 相位护盾
const BOSS_SKILLS = ['frenzy', 'summon', 'shield'];

function makeMesh(type, def) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a1030, emissive: def.color, emissiveIntensity: 1.4, roughness: 0.5,
    flatShading: true,
  });
  const inner = new THREE.Group();
  grp.add(inner);

  switch (type) {
    case 'drifter': { // 疾行者：尖锐八面体
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(def.size), mat);
      m.scale.y = 1.35;
      inner.add(m);
      break;
    }
    case 'shelled': { // 甲壳兽：扁平多面体 + 背刺
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(def.size, 0), mat);
      m.scale.y = 0.62;
      inner.add(m);
      for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.5, 4),
          new THREE.MeshStandardMaterial({ color: 0x2a1a4a, emissive: 0xc46bff, emissiveIntensity: 0.9 })
        );
        spike.position.set((i - 1) * 0.32, 0.38, -0.1);
        spike.rotation.x = -0.4;
        inner.add(spike);
      }
      break;
    }
    case 'floater': { // 悬浮者：浮空晶体 + 光环
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(def.size * 1.1), mat);
      inner.add(m);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(def.size * 1.5, 0.04, 6, 24),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7 })
      );
      halo.rotation.x = Math.PI / 2;
      inner.add(halo);
      inner.userData.halo = halo;
      break;
    }
    case 'splitter': { // 裂殖体：双球体
      const a = new THREE.Mesh(new THREE.SphereGeometry(def.size * 0.75, 8, 6), mat);
      a.position.y = def.size * 0.45;
      const b = new THREE.Mesh(new THREE.SphereGeometry(def.size * 0.55, 8, 6), mat);
      b.position.y = -def.size * 0.25;
      inner.add(a, b);
      break;
    }
    case 'boss': { // 潮汐巨兽
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(def.size, 1), mat);
      m.scale.y = 0.8;
      inner.add(m);
      for (let i = 0; i < 8; i++) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.22, 1.1, 4),
          new THREE.MeshStandardMaterial({ color: 0x300510, emissive: 0xff2d55, emissiveIntensity: 1.6 })
        );
        const ang = (i / 8) * Math.PI * 2;
        spike.position.set(Math.cos(ang) * def.size * 0.85, 0.2, Math.sin(ang) * def.size * 0.85);
        spike.rotation.z = Math.cos(ang) * 0.6;
        spike.rotation.x = -Math.sin(ang) * 0.6;
        inner.add(spike);
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(def.size * 1.35, 0.08, 8, 40),
        new THREE.MeshBasicMaterial({ color: 0xff2d55, transparent: true, opacity: 0.8 })
      );
      ring.rotation.x = Math.PI / 2;
      inner.add(ring);
      inner.userData.halo = ring;
      break;
    }
  }
  return { grp, inner };
}

export class Enemy {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3();
    this.alive = false;
    this.models = new Map(); // type -> {grp, inner} 池内复用
    this.currentModel = null;

    // 血条（受击后短暂显示）
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.13),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75, depthTest: false })
    );
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.16, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xff4455, transparent: true, depthTest: false })
    );
    fg.position.z = 0.01;
    this.hpBar = new THREE.Group();
    this.hpBar.add(bg, fg);
    this.hpBarFg = fg;
    this.hpBar.renderOrder = 999;
    this.hpBar.visible = false;
    scene.add(this.hpBar);
  }

  _getModel(type, def) {
    let m = this.models.get(type);
    if (!m) {
      m = makeMesh(type, def);
      m.grp.visible = false;
      this.scene.add(m.grp);
      this.models.set(type, m);
    }
    return m;
  }

  spawn(type, wave, waypoints, onDeath, onLeak, onSummon) {
    const def = ENEMIES[type];
    this.def = def;
    this.type = type;
    this.wave = wave;
    this.waypoints = waypoints;
    this.onDeath = onDeath;
    this.onLeak = onLeak;
    this.onSummon = onSummon;

    const scale = hpScale(wave) * (type === 'boss' ? 1 + 0.55 * Math.floor(wave / 5) : 1);
    this.maxHp = Math.round(def.hp * scale);
    this.hp = this.maxHp;
    this.baseSpeed = def.speed * speedScale(wave);
    this.slow = 0; this.slowT = 0;
    this.armor = def.armor || 0;
    this.flying = !!def.flying;
    this.size = def.size;
    this.alive = true;
    this.wpIndex = 1;
    this.showHpT = def.boss ? 1e9 : 0;
    this.t = Math.random() * 10;

    // Boss 技能状态
    if (def.boss) {
      this.skill = BOSS_SKILLS[(Math.floor(wave / 5) - 1) % 3];
      if (wave >= 25) this.skill = 'all';
      this.skillT = 0;
      this.skillPhase = 0; // 0=idle 1=active
      this.shielded = false;
    }

    // 起点
    const w0 = waypoints[0];
    this.pos.set(w0[0], 0, w0[1]);
    this.hitY = this.flying ? 2.3 : def.size + 0.3;

    if (this.currentModel && this.currentModel !== this.models.get(type)) this.currentModel.grp.visible = false;
    const m = this._getModel(type, def);
    this.currentModel = m;
    m.grp.visible = true;
    m.grp.position.copy(this.pos);
    m.grp.scale.setScalar(1);
    if (this.flying) m.grp.position.y = 2.3;

    this._applyMaterial();
  }

  _applyMaterial() {
    // 护盾态视觉
    const m = this.currentModel;
    m.inner.traverse(o => {
      if (o.isMesh && o.material.emissive) {
        o.material.emissiveIntensity = this.shielded ? 0.25 : 1.4;
      }
    });
    if (this.shielded) {
      if (!this._shieldMesh) {
        this._shieldMesh = new THREE.Mesh(
          new THREE.SphereGeometry(1, 12, 10),
          new THREE.MeshBasicMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        m.grp.add(this._shieldMesh);
      }
      this._shieldMesh.visible = true;
      this._shieldMesh.scale.setScalar(this.size * 1.5);
    } else if (this._shieldMesh) {
      this._shieldMesh.visible = false;
    }
  }

  damage(dmg, opts = {}) {
    if (!this.alive) return;
    if (this.shielded) { this.showHpT = 2.5; return; }
    const real = Math.max(dmg - this.armor, dmg * 0.2);
    this.hp -= real;
    this.showHpT = 2.5;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      if (this.onDeath) this.onDeath(this);
    }
  }

  applySlow(amount, dur) {
    if (this.shielded) return;
    this.slow = Math.max(this.slow, amount);
    this.slowT = Math.max(this.slowT, dur);
  }

  update(dt, camera, game) {
    if (!this.alive) return;
    this.t += dt;

    // 减速
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 0; }

    // Boss 技能
    if (this.def.boss) this._bossSkill(dt);
    const speed = this.effectiveSpeed;

    // 移动
    const m = this.currentModel;
    if (this.flying) {
      // 直线飞向潮核
      const dx = 0 - this.pos.x, dz = 16 - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        this.alive = false;
        if (this.onLeak) this.onLeak(this);
        return;
      }
      this.pos.x += (dx / d) * speed * dt;
      this.pos.z += (dz / d) * speed * dt;
      m.grp.position.set(this.pos.x, 2.3 + Math.sin(this.t * 3) * 0.25, this.pos.z);
      m.grp.rotation.y += dt * 1.2;
    } else {
      const wp = this.waypoints[this.wpIndex];
      if (!wp) {
        this.alive = false;
        if (this.onLeak) this.onLeak(this);
        return;
      }
      const dx = wp[0] - this.pos.x, dz = wp[1] - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = speed * dt;
      if (d <= step) {
        this.pos.set(wp[0], 0, wp[1]);
        this.wpIndex++;
      } else {
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        m.grp.rotation.y = Math.atan2(dx, dz);
      }
      m.grp.position.copy(this.pos);
      if (this.type === 'drifter') { m.grp.rotation.y += this.t * 2; m.grp.rotation.x = this.t * 3; }
      if (this.type === 'splitter') m.grp.rotation.z = Math.sin(this.t * 4) * 0.2;
      if (this.type === 'boss') m.grp.rotation.y += dt * 0.4;
    }
    if (m.inner.userData.halo) m.inner.userData.halo.rotation.z += dt * 2;
    // 冻结色调
    const tint = this.slow > 0;
    m.inner.traverse(o => {
      if (o.isMesh && o.material.emissive && !this.shielded) {
        o.material.emissiveIntensity = tint ? 0.7 : 1.4;
      }
    });

    // 血条
    if (this.showHpT > 0) {
      this.showHpT -= dt;
      this.hpBar.visible = true;
      const barScale = this.def.boss ? 2.6 : 1;
      this.hpBar.position.set(this.pos.x, (this.flying ? 3.6 : this.size + 1.35), this.pos.z);
      this.hpBar.quaternion.copy(camera.quaternion);
      this.hpBar.scale.setScalar(barScale);
      const r = this.hp / this.maxHp;
      this.hpBarFg.scale.x = Math.max(r, 0.001);
      this.hpBarFg.position.x = -(1 - r) * 0.58;
      this.hpBarFg.material.color.setHSL(THREE.MathUtils.lerp(0, 0.33, r), 0.9, 0.55);
    } else {
      this.hpBar.visible = false;
    }
  }

  _bossSkill(dt) {
    this.skillT += dt;
    const cycle = this.skill === 'frenzy' ? 7 : this.skill === 'summon' ? 6 : 8;
    const active = 3;
    if (this.skillPhase === 0 && this.skillT >= cycle) {
      this.skillT = 0; this.skillPhase = 1;
      // 触发
      if (this.skill === 'frenzy' || this.skill === 'all') this._frenzyOn = true;
      if ((this.skill === 'shield' || this.skill === 'all') && !this.shielded) {
        this.shielded = true;
        setTimeout(() => { if (this.alive && this.shielded) { this.shielded = false; this._applyMaterial(); } }, 1800);
      }
      if (this.skill === 'summon' || this.skill === 'all') {
        if (this.onSummon) this.onSummon(this);
      }
      this._applyMaterial();
    } else if (this.skillPhase === 1 && this.skillT >= active) {
      this.skillT = 0; this.skillPhase = 0;
      this._frenzyOn = false;
    }
    if (this._frenzyOn) this.baseSpeedMult = 2.1;
    else this.baseSpeedMult = 1;
  }

  // boss 召唤的小怪沿用当前波次缩放
  get effectiveSpeed() { return this.baseSpeed * (this.baseSpeedMult || 1) * (1 - this.slow); }

  despawnVisual() {
    if (this.currentModel) this.currentModel.grp.visible = false;
    this.hpBar.visible = false;
  }
}

// 敌人池
export class EnemyPool {
  constructor(scene) {
    this.scene = scene;
    this.all = [];      // 全部实例（供复用）
    this.active = [];   // 场上活跃
  }
  spawn(type, wave, waypoints, onDeath, onLeak, onSummon) {
    let e = this.all.find(x => !x.alive);
    if (!e) {
      if (this.all.length > 140) return null; // 上限保护
      e = new Enemy(this.scene);
      this.all.push(e);
    }
    e.spawn(type, wave, waypoints, onDeath, onLeak, onSummon);
    this.active.push(e);
    return e;
  }
  update(dt, camera, game) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.update(dt, camera, game);
      if (!e.alive) {
        // 死亡或漏怪，处理移除
        e.despawnVisual();
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
    }
  }
  clear() {
    for (const e of this.active) { e.alive = false; e.despawnVisual(); }
    this.active.length = 0;
  }
}
