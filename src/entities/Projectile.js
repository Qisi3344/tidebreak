import * as THREE from 'three';

// 弹道对象池：追踪弹（塔/英雄分裂弹）与直线弹（英雄主炮）
// 命中回调由 Game 注入 onHit(target, spec)
const MAX_PROJ = 260;

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.active = [];
    this.onHit = null; // (target, proj) => void

    const geo = new THREE.SphereGeometry(0.14, 6, 5);
    this.mats = new Map(); // color -> material 缓存
    for (let i = 0; i < MAX_PROJ; i++) {
      const mesh = new THREE.Mesh(geo, null);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push(mesh);
    }
  }

  _mat(color) {
    if (!this.mats.has(color)) {
      this.mats.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return this.mats.get(color);
  }

  // spec: {kind:'chase'|'line', target, dir, speed, dmg, aoe, hitsFly, color, pierce}
  spawn(pos, spec) {
    const mesh = this.pool.pop();
    if (!mesh) return;
    mesh.material = this._mat(spec.color);
    mesh.position.copy(pos);
    mesh.scale.setScalar(spec.aoe ? 1.5 : 1);
    mesh.visible = true;
    const p = {
      mesh, ...spec,
      life: spec.kind === 'line' ? spec.range / spec.speed : 4,
      dist: 0,
    };
    this.active.push(p);
  }

  update(dt, grid, enemies) {
    const hitList = [];
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      let dead = p.life <= 0;

      if (p.kind === 'chase') {
        // 追踪目标；目标死亡则消散
        const t = p.target;
        if (!t || !t.alive) { dead = true; }
        else {
          const m = p.mesh;
          const dx = t.pos.x - m.position.x, dy = t.hitY - m.position.y, dz = t.pos.z - m.position.z;
          const d = Math.hypot(dx, dy, dz);
          const step = p.speed * dt;
          if (d <= step + 0.25) {
            if (this.onHit) this.onHit(t, p);
            dead = true;
          } else {
            m.position.x += (dx / d) * step;
            m.position.y += (dy / d) * step;
            m.position.z += (dz / d) * step;
          }
        }
      } else {
        // 直线弹：逐步检测附近敌人
        const m = p.mesh;
        const step = p.speed * dt;
        m.position.x += p.dir.x * step;
        m.position.y += p.dir.y * step;
        m.position.z += p.dir.z * step;
        p.dist += step;
        grid.queryCircle(m.position.x, m.position.z, 1.2 + (p.radius || 0), hitList);
        let hit = null;
        for (const e of hitList) {
          if (!e.alive) continue;
          if (e.flying && !p.hitsFly) continue;
          const dx = e.pos.x - m.position.x, dz = e.pos.z - m.position.z;
          const dy = e.hitY - m.position.y;
          // 飞行单位放宽垂直判定，保证英雄直线弹可对空
          const vTol = e.flying ? 1.7 : e.size + 0.45;
          if (dx * dx + dz * dz < (e.size + 0.45) ** 2 && Math.abs(dy) < vTol) { hit = e; break; }
        }
        if (hit) {
          if (this.onHit) this.onHit(hit, p);
          if (!p.pierce) dead = true;
        }
        if (p.dist > p.range) dead = true;
      }

      if (dead) {
        p.mesh.visible = false;
        this.pool.push(p.mesh);
        this.active[i] = this.active[this.active.length - 1];
        this.active.pop();
      }
    }
  }

  clear() {
    for (const p of this.active) { p.mesh.visible = false; this.pool.push(p.mesh); }
    this.active.length = 0;
  }
}
