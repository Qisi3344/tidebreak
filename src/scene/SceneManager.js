import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 渲染器 / 相机 / 灯光 / Bloom 后处理，一页管完
export class SceneManager {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050810);
    this.scene.fog = new THREE.FogExp2(0x050810, 0.011);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camAnchor = new THREE.Vector3(0, 0, 3);
    this.camDist = 1.0; // 缩放系数
    this._placeCamera();

    // 灯光：环境 + 两盏平行光 + 核心点光（World 会加）
    this.scene.add(new THREE.AmbientLight(0x334466, 1.4));
    const key = new THREE.DirectionalLight(0x9db4ff, 1.6);
    key.position.set(18, 30, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x3366ff, 0.8);
    rim.position.set(-16, 18, -14);
    this.scene.add(rim);

    // 星空
    this._makeStars();

    // 后处理：辉光
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.85, // strength
      0.55, // radius
      0.62  // threshold
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', () => this._onResize());
  }

  _placeCamera() {
    const d = this.camDist;
    this.camera.position.set(this.camAnchor.x, 40 * d, this.camAnchor.z + 27 * d);
    this.camera.lookAt(this.camAnchor.x, 0, this.camAnchor.z);
  }

  zoom(delta) {
    this.camDist = THREE.MathUtils.clamp(this.camDist + delta * 0.08, 0.6, 1.5);
    this._placeCamera();
  }

  _makeStars() {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 120 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(p) * Math.cos(t);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(p)) * 0.6 + 18;
      pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0x9fc8ff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(g, m);
    stars.frustumCulled = false;
    this.scene.add(stars);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  render(dt) {
    this.composer.render(dt);
  }
}
