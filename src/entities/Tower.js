import * as THREE from 'three';
import { TOWERS, MAP } from '../core/config.js';

// 塔：数据驱动（config.TOWERS），逻辑分 single/slow/splash/beam/snipe 五类
function buildTowerBody(type, def) {
  const color = def.color;
  const grp = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x141d33, roughness: 0.85 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x101826, emissive: color, emissiveIntensity: 1.5, roughness: 0.4, flatShading: true });

  // 基座（各塔通用）
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 0.5, 8), dark);
  base.position.y = 0.25;
  grp.add(base);

  const turret = new THREE.Group(); // 旋转指向目标
  turret.position.y = 0.5;
  grp.add(turret);

  switch (type) {
    case 'pulse': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), glow);
      body.position.y = 0.3;
      turret.add(body);
      const barrel = new THREE.Group();
      const bmat = new THREE.MeshStandardMaterial({ color: 0x0d1622, emissive: color, emissiveIntensity: 0.7 });
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 6), bmat);
      b1.rotation.x = Math.PI / 2; b1.position.set(0.16, 0.32, 0.45);
      const b2 = b1.clone(); b2.position.x = -0.16;
      barrel.add(b1, b2);
      turret.add(barrel);
      turret.userData.muzzles = [new THREE.Vector3(0.16, 0.82, 0.95), new THREE.Vector3(-0.16, 0.82, 0.95)];
      break;
    }
    case 'frost': {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.9, 6), dark);
      pillar.position.y = 0.45;
      grp.add(pillar);
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), glow);
      orb.position.y = 1.3;
      grp.add(orb);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.05, 6, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.3;
      grp.add(ring);
      grp.userData.orb = orb; grp.userData.ring = ring;
      break;
    }
    case 'starfire': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.5, 8), dark);
      body.position.y = 0.5;
      turret.add(body);
      const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 1.0, 10), glow);
      mortar.rotation.x = -Math.PI / 3;
      mortar.position.set(0, 0.85, 0.2);
      turret.add(mortar);
      turret.userData.muzzles = [new THREE.Vector3(0, 1.25, 0.55)];
      break;
    }
    case 'prism': {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 1.5, 6), dark);
      pillar.position.y = 0.95;
      grp.add(pillar);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), glow);
      crystal.position.y = 1.85;
      crystal.scale.y = 1.4;
      grp.add(crystal);
      grp.userData.crystal = crystal;
      break;
    }
    case 'longbow': {
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.1, 5), dark);
        const a = (i / 3) * Math.PI * 2;
        leg.position.set(Math.cos(a) * 0.4, 0.55, Math.sin(a) * 0.4);
        leg.rotation.z = Math.cos(a) * 0.35;
        leg.rotation.x = -Math.sin(a) * 0.35;
        grp.add(leg);
      }
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.5, 6), glow);
      gun.rotation.x = Math.PI / 2.6;
      gun.position.set(0, 1.15, 0.3);
      turret.add(gun);
      turret.userData.muzzles = [new THREE.Vector3(0, 1.35, 1.0)];
      break;
    }
  }
  return { grp, turret };
}

export class Tower {
  constructor(scene, type, gx, gz, world) {
    this.scene = scene;
    this.type = type;
    this.def = TOWERS[type];
    this.gx = gx; this.gz = gz;
    this.level = 0;
    this.cd = 0;
    this.t = Math.random() * 10;
    this.invested = this.def.levels[0].cost;

    const { x, z } = world.gridToWorld(gx, gz);
    this.pos = new THREE.Vector3(x, 0, z);

    const body = buildTowerBody(type, this.def);
    this.grp = body.grp;
    this.turret = body.turret;
    this.grp.position.copy(this.pos);
    scene.add(this.grp);

    // 级别指示环（升级后点亮）
    this.levelRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.045, 6, 24),
      new THREE.MeshBasicMaterial({ color: this.def.color, transparent: true, opacity: 0.0 })
    );
    this.levelRing.rotation.x = Math.PI / 2;
    this.levelRing.position.y = 0.06;
    this.grp.add(this.levelRing);

    // 棱镜激光束
    if (this.def.dmgType === 'beam') {
      const bg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
      this.beam = new THREE.Line(bg, new THREE.LineBasicMaterial({ color: this.def.color, transparent: true, opacity: 0.9 }));
      this.beam.visible = false;
      scene.add(this.beam);
    }
  }

  get stats() { return this.def.levels[this.level]; }
  get sellValue() { return Math.floor(this.invested * 0.7); }
  get maxLevel() { return this.level >= this.def.levels.length - 1; }
  get upgradeCost() { return this.maxLevel ? null : this.def.levels[this.level + 1].cost; }

  upgrade() {
    if (this.maxLevel) return false;
    this.invested += this.upgradeCost;
    this.level++;
    // 视觉反馈：放大 + 级别环
    this.grp.scale.setScalar(1 + this.level * 0.12);
    this.levelRing.material.opacity = 0.35 + this.level * 0.3;
    return true;
  }

  update(dt, grid, game) {
    this.t += dt;
    const s = this.stats;
    const dmgMul = game ? game.globalDmgMul || 1 : 1;
    this.cd -= dt;

    // 目标选择
    const found = game.queryEnemies(this.pos.x, this.pos.z, s.range, this._q || (this._q = []));
    let target = null;
    if (found.length) {
      if (this.type === 'longbow') {
        // 狙击：优先血量最高（含飞行）
        let best = -1;
        for (const e of found) {
          if (e.hp > best) { best = e.hp; target = e; }
        }
      } else {
        // 领头策略：距潮核最近（臼炮不打飞行）
        let best = Infinity;
        for (const e of found) {
          if (e.flying && this.def.dmgType === 'splash') continue;
          const d = Math.hypot(e.pos.x, e.pos.z - 16);
          if (d < best) { best = d; target = e; }
        }
      }
    }

    // 炮口朝向
    if (target && this.turret) {
      const ang = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
      this.turret.rotation.y = ang;
    }

    if (!target) { if (this.beam) this.beam.visible = false; return; }

    const topY = this.type === 'prism' ? 1.85 : this.type === 'longbow' ? 1.3 : 0.95;
    const muzzleWorld = this.pos.clone().setY(topY);
    if (this.turret && this.turret.userData.muzzles) {
      const mz = this.turret.userData.muzzles[0];
      muzzleWorld.add(new THREE.Vector3(mz.x, mz.y - 0.5, mz.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.turret.rotation.y));
    }

    switch (this.def.dmgType) {
      case 'beam': {
        // 持续光束，每秒伤害
        this.beam.visible = true;
        const positions = this.beam.geometry.attributes.position;
        positions.setXYZ(0, muzzleWorld.x, muzzleWorld.y, muzzleWorld.z);
        positions.setXYZ(1, target.pos.x, target.hitY, target.pos.z);
        positions.needsUpdate = true;
        this.beam.material.opacity = 0.55 + Math.sin(this.t * 30) * 0.25;
        target.damage(s.dmg * dmgMul * dt, { src: 'beam' });
        if (this.grp.userData.crystal) this.grp.userData.crystal.rotation.y += dt * 6;
        break;
      }
      case 'slow': {
        // 范围霜爆脉冲
        if (this.cd <= 0) {
          this.cd = 1 / s.rate;
          const hit = game.queryEnemies(this.pos.x, this.pos.z, s.aoe, this._q2 || (this._q2 = []));
          for (const e of hit) {
            e.damage(s.dmg * dmgMul);
            e.applySlow(s.slow, s.slowDur);
          }
          game.onFrostPulse(this.pos, s.aoe);
        }
        if (this.grp.userData.orb) this.grp.userData.orb.rotation.y += dt * 2;
        break;
      }
      default: {
        // single / splash / snipe —— 发射追踪弹
        if (this.cd <= 0) {
          this.cd = 1 / s.rate;
          game.spawnProjectile(muzzleWorld, {
            kind: 'chase', target, speed: this.type === 'longbow' ? 38 : 24,
            dmg: s.dmg * dmgMul, aoe: s.aoe || 0, hitsFly: true, color: this.def.color,
          });
          game.onTowerShoot(this, muzzleWorld);
        }
        break;
      }
    }
  }

  dispose(world) {
    this.scene.remove(this.grp);
    if (this.beam) this.scene.remove(this.beam);
    world.free(this.gx, this.gz);
    this.disposed = true;
  }
}
