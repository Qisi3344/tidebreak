import * as THREE from 'three';
import { HERO, MAP } from '../core/config.js';

// 英雄"汐卫"：WASD 移动 / 鼠标瞄准 / 左键连射 / Q 汐爆 / E 时滞力场 / 击杀攒经验升级
export class Hero {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(0, 0, 8);
    this.aim = new THREE.Vector3(0, 0, 14); // 瞄准点（世界坐标）
    this.keys = {};
    this.mouseDown = false;
    this.shootT = 0;
    this.t = 0;

    this.level = 1;
    this.xp = 0;
    this.upgrades = { rate: 0, dmg: 0, speed: 0, cd: 0, multi: 0, blast: 0 };
    this.cdQ = 0; this.cdE = 0;
    this.pendingLevelUps = 0;

    this._buildMesh();
    this._buildAimMarker();
    this._buildFieldPrefab();
  }

  _buildMesh() {
    const grp = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0e2233, emissive: 0x35e0ff, emissiveIntensity: 1.1, roughness: 0.4, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14202f, roughness: 0.8 });

    // 悬浮机甲：箭形机体 + 双侧浮翼 + 尾焰
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 4), bodyMat);
    hull.rotation.x = Math.PI / 2;
    hull.rotation.y = Math.PI / 4;
    hull.position.y = 0.9;
    grp.add(hull);

    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.5), dark);
    wingL.position.set(-0.65, 0.75, 0.15);
    const wingR = wingL.clone();
    wingR.position.x = 0.65;
    const wGlow = new THREE.MeshStandardMaterial({ color: 0x101826, emissive: 0x35e0ff, emissiveIntensity: 1.8 });
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.6), wGlow);
    tipL.position.set(-1.0, 0.78, 0.15);
    const tipR = tipL.clone(); tipR.position.x = 1.0;
    grp.add(wingL, wingR, tipL, tipR);

    // 炮口
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 6), wGlow);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(0, 0.95, 0.7);
    grp.add(gun);

    // 尾焰（射击/移动时变亮）
    this.thruster = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.thruster.rotation.x = -Math.PI / 2;
    this.thruster.position.set(0, 0.9, -1.0);
    grp.add(this.thruster);

    // 脚下悬浮光环
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = 0.12;
    grp.add(this.halo);

    grp.position.copy(this.pos).setY(0);
    this.grp = grp;
    this.muzzleOffset = new THREE.Vector3(0, 0.95, 1.0);
    this.scene.add(grp);
  }

  _buildAimMarker() {
    const g = new THREE.RingGeometry(0.32, 0.5, 24);
    g.rotateX(-Math.PI / 2);
    this.aimMarker = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.55, depthWrite: false }));
    this.aimMarker.position.y = 0.18;
    this.scene.add(this.aimMarker);
  }

  _buildFieldPrefab() {
    // E 技能：时滞力场可视化
    this.fields = [];
    this.fieldGeo = new THREE.CircleGeometry(1, 40);
    this.fieldGeo.rotateX(-Math.PI / 2);
  }

  // ---------- 输入 ----------
  setKey(code, down) { this.keys[code] = down; }
  setAim(point) { this.aim.copy(point); }
  setFiring(f) { this.mouseDown = f; }

  // ---------- 数值（含升级加成）----------
  get shootRate() { return HERO.shootRate * (1 + 0.25 * this.upgrades.rate); }
  get shootDmg() { return HERO.shootDmg * (1 + 0.3 * this.upgrades.dmg); }
  get moveSpeed() { return HERO.moveSpeed * (1 + 0.15 * this.upgrades.speed); }
  get cdMult() { return Math.max(0.4, 1 - 0.2 * this.upgrades.cd); }
  get xpNeed() { return HERO.xpToLevel(this.level); }

  gainXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.pendingLevelUps++;
    }
  }

  applyUpgrade(id) {
    this.upgrades[id]++;
    if (id === 'blast') { /* 汐爆加成即时生效 */ }
  }

  // ---------- 技能 ----------
  trySkillQ(game) {
    if (this.cdQ > 0) return false;
    this.cdQ = HERO.skillQ.cd * this.cdMult;
    const radius = HERO.skillQ.radius * (1 + 0.25 * this.upgrades.blast);
    const dmg = HERO.skillQ.dmg * (1 + 0.4 * this.upgrades.blast);
    const at = this.aim.clone();
    const hit = game.queryEnemies(at.x, at.z, radius, []);
    for (const e of hit) e.damage(dmg, { src: 'skillQ' });
    game.onNovaBlast(at, radius);
    return true;
  }

  trySkillE(game) {
    if (this.cdE > 0) return false;
    this.cdE = HERO.skillE.cd * this.cdMult;
    const { radius, slow, dur } = HERO.skillE;
    const at = this.aim.clone();
    const mesh = new THREE.Mesh(
      this.fieldGeo,
      new THREE.MeshBasicMaterial({ color: 0x8ab6ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    mesh.position.set(at.x, 0.2, at.z);
    mesh.scale.setScalar(radius);
    this.scene.add(mesh);
    this.fields.push({ mesh, pos: at, radius, slow, t: dur, dur });
    game.onStasisField(at, radius);
    return true;
  }

  // ---------- 主更新 ----------
  update(dt, game) {
    this.t += dt;
    this.cdQ = Math.max(0, this.cdQ - dt);
    this.cdE = Math.max(0, this.cdE - dt);
    this.shootT -= dt;

    // 移动
    let mx = 0, mz = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz);
      this.pos.x += (mx / len) * this.moveSpeed * dt;
      this.pos.z += (mz / len) * this.moveSpeed * dt;
      const lim = MAP.half - 1.2;
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
    }

    // 朝向瞄准点
    const ang = Math.atan2(this.aim.x - this.pos.x, this.aim.z - this.pos.z);
    this.grp.rotation.y = ang;
    this.grp.position.set(this.pos.x, 0.15 + Math.sin(this.t * 2.4) * 0.08, this.pos.z);
    this.thruster.scale.setScalar(moving ? 1.5 : 1);
    this.thruster.material.opacity = moving ? 0.85 : 0.45;
    this.halo.rotation.z += dt;

    this.aimMarker.position.x = this.aim.x;
    this.aimMarker.position.z = this.aim.z;
    this.aimMarker.rotation.y += dt * 2;

    // 射击
    if (this.mouseDown && this.shootT <= 0) {
      this.shootT = 1 / this.shootRate;
      const from = this.pos.clone().add(this.muzzleOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), ang)).setY(0.95);
      const dir = new THREE.Vector3(this.aim.x - from.x, 0, this.aim.z - from.z).normalize();
      game.spawnProjectile(from, {
        kind: 'line', dir, speed: HERO.bulletSpeed, range: HERO.shootRange,
        dmg: this.shootDmg, color: 0x9ff5ff, hitsFly: true,
      });
      if (this.upgrades.multi > 0) {
        game.spawnProjectile(from, {
          kind: 'chase', target: game.pickNearestEnemy(this.aim.x, this.aim.z, HERO.shootRange),
          speed: 20, dmg: this.shootDmg * 0.5, color: 0x35e0ff, hitsFly: true,
        });
      }
      game.onHeroShoot(from);
    }

    // 力场持续
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.t -= dt;
      const hit = game.queryEnemies(f.pos.x, f.pos.z, f.radius, []);
      for (const e of hit) e.applySlow(f.slow, 0.3);
      f.mesh.material.opacity = 0.16 + 0.14 * Math.sin(this.t * 6) * (f.t / f.dur) + 0.12 * (f.t / f.dur);
      if (f.t <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.fields.splice(i, 1);
      }
    }
  }

  reset() {
    this.pos.set(0, 0, 8);
    this.level = 1; this.xp = 0;
    this.upgrades = { rate: 0, dmg: 0, speed: 0, cd: 0, multi: 0, blast: 0 };
    this.cdQ = 0; this.cdE = 0; this.pendingLevelUps = 0;
    for (const f of this.fields) { this.scene.remove(f.mesh); f.mesh.material.dispose(); }
    this.fields.length = 0;
    this.keys = {}; this.mouseDown = false;
  }
}
