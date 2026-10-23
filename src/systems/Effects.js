import * as THREE from 'three';

// GPU 点粒子池（CPU 更新速度/寿命，shader 渲染 per-point size/alpha）
const MAX = 1400;

const VERT = `
attribute float aSize; attribute vec3 aColor; attribute float aAlpha;
varying vec3 vColor; varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (160.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec3 vColor; varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.alpha = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.maxLife = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
    this._c = new THREE.Color();

    // 扩散环池
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.92, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, t: 0, dur: 0.5, radius: 3 });
    }
  }

  // 爆散粒子
  burst(x, y, z, colorHex, { count = 12, speed = 5, life = 0.6, size = 0.5, up = 2, gravity = 6, spread = 1 } = {}) {
    this._c.set(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      const sp = speed * (0.4 + r * 0.8) * spread;
      this.pos[idx * 3] = x; this.pos[idx * 3 + 1] = y; this.pos[idx * 3 + 2] = z;
      this.vel[idx * 3] = Math.cos(a) * sp;
      this.vel[idx * 3 + 1] = up * (0.3 + Math.random());
      this.vel[idx * 3 + 2] = Math.sin(a) * sp;
      this.life[idx] = this.maxLife[idx] = life * (0.6 + Math.random() * 0.7);
      this.grav[idx] = gravity;
      this.col[idx * 3] = this._c.r; this.col[idx * 3 + 1] = this._c.g; this.col[idx * 3 + 2] = this._c.b;
      this.size[idx] = size * (0.6 + Math.random() * 0.8);
      this.alpha[idx] = 1;
    }
  }

  // 地面扩散环
  ring(x, z, colorHex, radius = 3, dur = 0.5) {
    const r = this.rings.find(r => !r.mesh.visible) || this.rings[0];
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.25, z);
    r.mesh.material.color.set(colorHex);
    r.t = 0; r.dur = dur; r.radius = radius;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; dirty = true; } continue; }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.4; }
      this.alpha[i] = Math.max(this.life[i] / this.maxLife[i], 0);
      dirty = true;
    }
    if (dirty) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.aAlpha.needsUpdate = true;
      this.points.geometry.attributes.aColor.needsUpdate = true;
      this.points.geometry.attributes.aSize.needsUpdate = true;
    }
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.mesh.visible = false; continue; }
      const s = 0.3 + k * r.radius;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - k) * 0.8;
    }
  }
}
