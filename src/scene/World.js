import * as THREE from 'three';
import { MAP, PATH_MAIN, PATH_WEST } from '../core/config.js';

// ---------- 简单 value noise（程序化地形用）----------
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}
export function distToPath(x, z, paths) {
  let d = Infinity;
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      d = Math.min(d, segDist(x, z, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]));
    }
  }
  return d;
}

// 地形 + 路径 + 建造网格 + 潮核 + 裂隙 + 装饰
export class World {
  constructor(scene) {
    this.scene = scene;
    this.paths = [PATH_MAIN, PATH_WEST]; // 西路径参与占位判定但默认熄灭
    this.grid = new Map(); // "gx,gz" -> tower
    this.time = 0;
    this.corePos = new THREE.Vector3(0, 1, 16);

    this._buildTerrain();
    this._buildPaths();
    this._buildCore();
    this._buildRifts();
    this._buildDecor();
    this._buildHoverTile();
  }

  // ---------- 地形 ----------
  _buildTerrain() {
    const S = MAP.size + 10;
    const g = new THREE.PlaneGeometry(S, S, 72, 72);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(0x0a1430); // 低洼深蓝
    const cB = new THREE.Color(0x1a2b55); // 高处蓝紫
    const cGlow = new THREE.Color(0x0e3a4a);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = vnoise(x * 0.09 + 10, z * 0.09 + 10) * 0.7 + vnoise(x * 0.28, z * 0.28) * 0.3;
      let h = (n - 0.45) * 2.6;
      // 路径与核心附近压平
      const dPath = distToPath(x, z, [PATH_MAIN, PATH_WEST]);
      const flat = THREE.MathUtils.clamp((dPath - 2.0) / 3.0, 0, 1);
      h *= flat;
      const dCore = Math.hypot(x - 0, z - 16);
      if (dCore < 5) h *= THREE.MathUtils.clamp((dCore - 2.5) / 2.5, 0, 1);
      // 外圈抬升成盆地边缘
      const edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge > MAP.half - 1) h += (edge - (MAP.half - 1)) * 0.55;
      pos.setY(i, h);

      const c = cA.clone().lerp(cB, THREE.MathUtils.clamp(h / 2.5 + 0.4, 0, 1));
      if (dPath < 2.4) c.lerp(cGlow, 0.5);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.05 });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.y = -0.35;
    this.scene.add(mesh);
  }

  // ---------- 发光路径 ----------
  _buildPaths() {
    const matMain = new THREE.MeshStandardMaterial({
      color: 0x0c2a33, emissive: 0x18c8e8, emissiveIntensity: 0.55, roughness: 0.6,
    });
    this.pathMats = { main: matMain };
    const matWest = new THREE.MeshStandardMaterial({
      color: 0x0c2a33, emissive: 0xff44aa, emissiveIntensity: 0.55, roughness: 0.6,
    });
    this.pathMats.west = matWest;

    this._pathStrip(PATH_MAIN, matMain);
    // 西路径初始熄灭且隐藏，开启时点亮
    matWest.emissiveIntensity = 0;
    matWest.color.set(0x0a1420);
    this.westStrip = new THREE.Group();
    this.scene.add(this.westStrip);
    this._pathStrip(PATH_WEST, matWest, this.westStrip);
    this.westStrip.visible = false;
  }

  _pathStrip(path, mat, parent) {
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i], [bx, bz] = path[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(len, 0.14, 2.4);
      const m = new THREE.Mesh(g, mat);
      m.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
      m.rotation.y = -Math.atan2(bz - az, bx - ax);
      (parent || this.scene).add(m);
    }
  }

  // ---------- 潮核 ----------
  _buildCore() {
    const grp = new THREE.Group();
    grp.position.copy(this.corePos).setY(1.1);
    this.core = grp;

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 2.2, roughness: 0.3,
    });
    this.coreMat = mat;
    this.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), mat);
    grp.add(this.coreMesh);

    this.coreRings = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.6 + i * 0.45, 0.05, 8, 48),
        new THREE.MeshStandardMaterial({ color: 0x6ee7ff, emissive: 0x35d0ff, emissiveIntensity: 1.6 })
      );
      ring.rotation.x = Math.PI / 2 + i * 0.5;
      grp.add(ring);
      this.coreRings.push(ring);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.5, 9, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 4.5;
    grp.add(beam);

    const light = new THREE.PointLight(0xffc860, 40, 16, 1.8);
    grp.add(light);
    this.coreLight = light;

    // 底座
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.6, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x16233f, roughness: 0.8 })
    );
    base.position.set(0, 0.05, 16);
    this.scene.add(base);

    this.scene.add(grp);
  }

  // ---------- 裂隙 ----------
  _buildRifts() {
    this.rifts = {};
    const make = (x, z, rotY, color) => {
      const grp = new THREE.Group();
      grp.position.set(x, 1.2, z);
      grp.rotation.y = rotY;
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(1.7, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      grp.add(disk);
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(
          new THREE.TorusGeometry(1.5 + i * 0.4, 0.06, 8, 40),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        grp.add(r);
        rings.push(r);
      }
      const light = new THREE.PointLight(color, 30, 12, 2);
      grp.add(light);
      this.scene.add(grp);
      return { grp, rings, light, disk };
    };
    this.rifts.main = make(22, -14, Math.PI / 2, 0x18e8ff);
    this.rifts.west = make(-22, 12, 0, 0xff44aa);
    this.rifts.west.grp.visible = false;
  }

  openWest() {
    if (this.rifts.west.grp.visible) return;
    this.rifts.west.grp.visible = true;
    this.westStrip.visible = true;
    this.pathMats.west.emissiveIntensity = 0.55;
    this.pathMats.west.color.set(0x0c2a33);
  }

  // ---------- 装饰 ----------
  _buildDecor() {
    const crystalColors = [0x9d6bff, 0x35e0ff, 0xff5ad1];
    let placed = 0, tries = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    while (placed < 46 && tries < 900) {
      tries++;
      const x = rnd(-MAP.half + 2, MAP.half - 2), z = rnd(-MAP.half + 2, MAP.half - 2);
      const dPath = distToPath(x, z, this.paths);
      const dCore = Math.hypot(x, z - 16);
      if (dPath < 2.6 || dCore < 4) continue;
      const isCrystal = Math.random() < 0.55;
      if (isCrystal) {
        const c = crystalColors[(Math.random() * 3) | 0];
        const h = rnd(0.6, 1.8);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(rnd(0.18, 0.4), h, 5),
          new THREE.MeshStandardMaterial({ color: 0x1a2440, emissive: c, emissiveIntensity: rnd(0.5, 1.3), roughness: 0.4 })
        );
        m.position.set(x, h / 2 - 0.2, z);
        m.rotation.y = rnd(0, Math.PI);
        m.rotation.z = rnd(-0.12, 0.12);
        this.scene.add(m);
      } else {
        // 海草簇
        const grp = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const h = rnd(0.5, 1.3);
          const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.07, h, 4),
            new THREE.MeshStandardMaterial({ color: 0x1b4a66, emissive: 0x0e5a7a, emissiveIntensity: 0.35 })
          );
          blade.position.set(rnd(-0.25, 0.25), h / 2, rnd(-0.25, 0.25));
          blade.rotation.z = rnd(-0.3, 0.3);
          grp.add(blade);
        }
        grp.position.set(x, -0.25, z);
        this.scene.add(grp);
      }
      placed++;
    }
  }

  // ---------- 悬停格子 ----------
  _buildHoverTile() {
    const g = new THREE.PlaneGeometry(MAP.cell * 0.92, MAP.cell * 0.92);
    g.rotateX(-Math.PI / 2);
    this.hoverMat = new THREE.MeshBasicMaterial({ color: 0x35e0a0, transparent: true, opacity: 0.28, depthWrite: false });
    this.hoverTile = new THREE.Mesh(g, this.hoverMat);
    this.hoverTile.position.y = 0.14;
    this.hoverTile.visible = false;
    this.scene.add(this.hoverTile);

    // 建造范围圈
    const rg = new THREE.RingGeometry(0.96, 1, 64);
    rg.rotateX(-Math.PI / 2);
    this.rangeMat = new THREE.MeshBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.rangeRing = new THREE.Mesh(rg, this.rangeMat);
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);
  }

  setHoverTile(gx, gz, ok) {
    if (gx === null) { this.hoverTile.visible = false; return; }
    const { x, z } = this.gridToWorld(gx, gz);
    this.hoverTile.position.x = x; this.hoverTile.position.z = z;
    this.hoverMat.color.set(ok ? 0x35e0a0 : 0xff5050);
    this.hoverTile.visible = true;
  }

  showRange(x, z, radius, color = 0x35e0ff) {
    this.rangeRing.position.set(x, 0.16, z);
    this.rangeRing.scale.setScalar(radius);
    this.rangeMat.color.set(color);
    this.rangeRing.visible = true;
  }
  hideRange() { this.rangeRing.visible = false; }

  // ---------- 网格工具 ----------
  worldToGrid(x, z) {
    return { gx: Math.floor((x + MAP.half) / MAP.cell), gz: Math.floor((z + MAP.half) / MAP.cell) };
  }
  gridToWorld(gx, gz) {
    return { x: -MAP.half + (gx + 0.5) * MAP.cell, z: -MAP.half + (gz + 0.5) * MAP.cell };
  }
  inBounds(gx, gz) { return gx >= 0 && gx < MAP.gridN && gz >= 0 && gz < MAP.gridN; }
  canBuild(gx, gz) {
    if (!this.inBounds(gx, gz)) return false;
    if (this.grid.has(`${gx},${gz}`)) return false;
    const { x, z } = this.gridToWorld(gx, gz);
    if (Math.hypot(x, z - 16) < 3.0) return false; // 潮核区
    return distToPath(x, z, this.paths) > MAP.cell * 0.92;
  }
  occupy(gx, gz, tower) { this.grid.set(`${gx},${gz}`, tower); }
  free(gx, gz) { this.grid.delete(`${gx},${gz}`); }
  towerAt(gx, gz) { return this.grid.get(`${gx},${gz}`) || null; }

  // ---------- 动画 ----------
  coreFlash() {
    this._coreFlashT = 0.35;
  }
  update(dt, camera) {
    this.time += dt;
    // 潮核
    this.coreMesh.rotation.y += dt * 0.5;
    this.coreMesh.rotation.x = Math.sin(this.time * 0.7) * 0.2;
    this.coreRings[0].rotation.z += dt * 0.8;
    this.coreRings[1].rotation.z -= dt * 0.5;
    if (this._coreFlashT > 0) {
      this._coreFlashT -= dt;
      const k = Math.max(this._coreFlashT / 0.35, 0);
      this.coreMat.emissive.setHex(0xff3020).lerp(new THREE.Color(0xffb347), 1 - k);
      this.coreLight.intensity = 40 + k * 120;
    }
    // 裂隙
    for (const key of ['main', 'west']) {
      const r = this.rifts[key];
      if (!r.grp.visible) continue;
      const dir = key === 'main' ? 1 : -1;
      r.rings.forEach((ring, i) => { ring.rotation.z += dt * (0.6 + i * 0.3) * dir; });
      r.disk.scale.setScalar(1 + Math.sin(this.time * 2.2) * 0.06);
    }
  }
}
