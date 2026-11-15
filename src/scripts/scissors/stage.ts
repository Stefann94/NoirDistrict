// Scena cu foarfeca din secțiunea „Ritualul”. Progresul (0→1) vine din scroll;
// foarfeca intră din adânc, taie de trei ori (la fiecare tăietură cad fire de păr) și iese.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createShears } from './model';

const { clamp, lerp, smoothstep } = THREE.MathUtils;

export interface ScissorsStage {
  setProgress(p: number): void;
  setActive(active: boolean): void;
}

export function createScissorsStage(canvas: HTMLCanvasElement): ScissorsStage {
  const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xe4e9ff, 3);
  rim.position.set(-4, 1.5, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.05));

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0, 7);

  const shears = createShears();
  const rig = new THREE.Group();
  rig.add(shears.object);
  scene.add(rig);

  // ---- Fire de păr: instanțe reciclate ----
  const MAX = lowPower ? 140 : 260;
  const hairGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 4);
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xcfc8bd, roughness: 0.55, metalness: 0.1 });
  const hair = new THREE.InstancedMesh(hairGeo, hairMat, MAX);
  hair.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hair.frustumCulled = false;
  scene.add(hair);
  const hp = new Float32Array(MAX * 3);
  const hv = new Float32Array(MAX * 3);
  const hr = new Float32Array(MAX * 3);
  const hw = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const len = new Float32Array(MAX);
  let next = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX; i++) hair.setMatrixAt(i, zero);

  const burst = (count: number) => {
    shears.object.updateWorldMatrix(true, true);
    for (let n = 0; n < count; n++) {
      const i = next;
      next = (next + 1) % MAX;
      // Pe tăiș, între a treia parte și vârf
      v.set(lerp(0.7, 2.7, Math.random()), (Math.random() - 0.5) * 0.06, 0);
      shears.pivot.localToWorld(v);
      hp.set([v.x, v.y, v.z], i * 3);
      hv.set([(Math.random() - 0.5) * 0.9, Math.random() * 0.6 - 0.1, (Math.random() - 0.5) * 0.9], i * 3);
      hr.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3);
      hw.set([(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8], i * 3);
      life[i] = 1;
      len[i] = lerp(0.07, 0.22, Math.random());
    }
  };

  const stepHair = (dt: number) => {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) continue;
      const k = i * 3;
      life[i] -= dt * 0.38;
      hv[k + 1] -= 2.2 * dt; // gravitație
      for (let a = 0; a < 3; a++) {
        hv[k + a] *= 1 - 1.6 * dt; // aer
        hp[k + a] += hv[k + a] * dt;
        hr[k + a] += hw[k + a] * dt;
      }
      if (life[i] <= 0) {
        hair.setMatrixAt(i, zero);
        continue;
      }
      const s = len[i] * Math.min(1, life[i] * 4);
      q.setFromEuler(e.set(hr[k], hr[k + 1], hr[k + 2]));
      m4.compose(v.set(hp[k], hp[k + 1], hp[k + 2]), q, sc.set(1, s, 1));
      hair.setMatrixAt(i, m4);
    }
    hair.instanceMatrix.needsUpdate = true;
  };

  // ---- Dimensiuni ----
  let mobile = false;
  let scale = 0.75;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mobile = w < 768;
    scale = clamp(camera.aspect * 0.5, 0.27, 0.62);
    rig.scale.setScalar(scale);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---- Coregrafia ----
  const SNIPS = 3;
  let target = 0;
  let current = 0;
  let lastOpen = 0;
  let active = false;
  let raf = 0;
  let last = performance.now();

  const pose = (p: number, time: number) => {
    const enter = smoothstep(p, 0, 0.16);
    const exit = smoothstep(p, 0.86, 1);
    const mid = clamp((p - 0.14) / 0.72, 0, 1);

    // Deschidere: ușor întredeschisă la intrare, apoi trei tăieturi complete.
    const cycle = 0.5 - 0.5 * Math.cos(mid * SNIPS * Math.PI * 2);
    const idle = 0.35 * (1 - smoothstep(p, 0.12, 0.2));
    const open = Math.max(cycle * (1 - exit), idle) * enter;
    shears.setOpen(open);

    const float = Math.sin(time * 0.9) * 0.05;
    rig.position.set(
      (mobile ? -0.18 : 1.05) + exit * (mobile ? 0 : 1.2),
      (mobile ? 0.62 : 0.05) + float + exit * 3.2,
      lerp(-9, 0, enter),
    );
    rig.rotation.set(
      0.4 - mid * 0.25 + Math.sin(time * 0.6) * 0.02,
      lerp(-1.5, -0.5, enter) + mid * 1.0,
      lerp(1.0, mobile ? 0.5 : 0.14, enter) - exit * 1.2,
    );
    camera.position.z = lerp(7, 6.1, mid);
    return open;
  };

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const prev = current;
    current += (target - current) * Math.min(1, dt * 9);
    const open = pose(current, now / 1000);
    // Tăietură: foarfeca se închide în timp ce derulezi înainte.
    if (current > prev && lastOpen > 0.07 && open <= 0.07 && current > 0.18 && current < 0.88) burst(lowPower ? 22 : 38);
    lastOpen = open;
    stepHair(dt);
    renderer.render(scene, camera);
    raf = active ? requestAnimationFrame(frame) : 0;
  };

  return {
    setProgress(p) {
      target = p;
    },
    setActive(on) {
      active = on;
      if (on && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    },
  };
}
