// Scena 3D a primei pagini. Lumea are câte o „stație” pentru fiecare capitol din HTML
// (`[data-chapter]`); scroll-ul nativ mută camera între ele, fără să fie deturnat.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createMaterials, createScissors, createClipper, createComb, createRazor } from './models';
import { createHead } from './head';

type V3 = [number, number, number];
interface Shot {
  t: number;
  pos: V3;
  look: V3;
  linear?: boolean;
}

const STATION: Record<'scissors' | 'clipper' | 'head' | 'razor', V3> = {
  scissors: [0, 0, 0],
  clipper: [3.5, -0.4, -14],
  head: [0, -0.1, -30],
  razor: [-3.5, 0.4, -44],
};

const at = (base: V3, d: V3): V3 => [base[0] + d[0], base[1] + d[1], base[2] + d[2]];

/** Camera în jurul frizurii: profil, spate, celălalt profil, de sus, înapoi în față. */
function orbitShots(): Shot[] {
  const c = STATION.head;
  const look = at(c, [0, 0.35, 0]);
  const keys: [number, number, number][] = [
    // [unghi (ture), înălțime, rază]
    [0, 0.5, 5.6],
    [0.25, 0.1, 4.4],
    [0.5, 1.0, 4.8],
    [0.75, 0.2, 4.4],
    [0.9, 3.2, 4.2],
    [1.0, 1.0, 5.4],
  ];
  const steps = 60;
  const shots: Shot[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let k = 0;
    while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
    const [t0, h0, r0] = keys[k];
    const [t1, h1, r1] = keys[k + 1];
    const u = THREE.MathUtils.smoothstep(t, t0, t1);
    const h = h0 + (h1 - h0) * u;
    const r = r0 + (r1 - r0) * u;
    const a = t * Math.PI * 2;
    shots.push({ t, pos: at(c, [Math.sin(a) * r, h, Math.cos(a) * r]), look, linear: true });
  }
  return shots;
}

const SHOTS: Record<string, Shot[]> = {
  intro: [
    { t: 0, pos: [0, 0.2, 7], look: [0, 0, 0] },
    { t: 0.5, pos: [-2.6, 1.0, 5.2], look: [0.2, 0, 0] },
    // Finalul: camera trece printre lame spre stația următoare.
    { t: 1, pos: [0.5, 0, 2.2], look: [0.55, 0, -4] },
  ],
  clipper: [
    { t: 0, pos: at(STATION.clipper, [0.3, 0.4, 5.2]), look: STATION.clipper },
    { t: 0.5, pos: at(STATION.clipper, [3.3, 1.2, 2.6]), look: at(STATION.clipper, [0, 0.3, 0]) },
    { t: 1, pos: at(STATION.clipper, [-1.6, 2.8, 3.0]), look: at(STATION.clipper, [0, 0.9, 0]) },
  ],
  fade: orbitShots(),
  razor: [
    { t: 0, pos: at(STATION.razor, [0, 0.6, 6.6]), look: at(STATION.razor, [-0.5, 0, 0]) },
    { t: 0.5, pos: at(STATION.razor, [-2.4, 1.6, 5.4]), look: at(STATION.razor, [-0.6, 0, 0]) },
    { t: 1, pos: at(STATION.razor, [1.6, -0.4, 5.6]), look: at(STATION.razor, [-0.3, 0, 0]) },
  ],
  booking: [
    { t: 0, pos: at(STATION.razor, [0.6, 2.4, 7.5]), look: STATION.razor },
    { t: 1, pos: at(STATION.razor, [-1.2, 4.2, 9.5]), look: STATION.razor },
  ],
};

interface Chapter {
  el: HTMLElement;
  name: string;
  top: number;
  span: number;
  /** Progresul din scroll-ul real, trimis în CSS ca `--p` (textul). */
  p: number;
  /** Progresul din scroll-ul netezit, pentru animațiile 3D. */
  sp: number;
}

export function startStage(canvas: HTMLCanvasElement) {
  const isMobile = () => innerWidth < 768;
  const lowPower = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let maxDpr = lowPower ? 1.5 : 1.75;

  const scene = new THREE.Scene();
  const bg = new THREE.Color(0x0b0b0c);
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 8, 22);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffdcae, 2.4);
  key.position.set(4, 5, 6);
  const rim = new THREE.DirectionalLight(0x9fb2ff, 1.6);
  rim.position.set(-5, 2, -6);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.08));

  // ---- Obiectele, fiecare la stația lui ----
  const m = createMaterials();
  const scissors = createScissors(m);
  scissors.object.position.set(...STATION.scissors);
  scissors.object.scale.setScalar(0.8);
  const clipper = createClipper(m);
  clipper.object.position.set(...STATION.clipper);
  clipper.object.scale.setScalar(0.85);
  const comb = createComb(m);
  comb.object.position.set(...at(STATION.clipper, [-2.4, 1.4, -1.8]));
  comb.object.rotation.set(0.3, 0.5, -0.4);
  const head = createHead(m, lowPower ? 9000 : 20000);
  head.object.position.set(...STATION.head);
  const razor = createRazor(m);
  razor.object.position.set(...STATION.razor);
  razor.object.scale.setScalar(0.75);
  scene.add(scissors.object, clipper.object, comb.object, head.object, razor.object);

  // Praf auriu în aer, pentru adâncime.
  const dustCount = lowPower ? 300 : 700;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, 6 - Math.random() * 58], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: 0xc9a56b,
      size: 0.025,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);

  // ---- Capitole și cadre de cameră pe axa de scroll ----
  const chapters: Chapter[] = [...document.querySelectorAll<HTMLElement>('[data-chapter]')].map((el) => ({
    el,
    name: el.dataset.chapter!,
    top: 0,
    span: 1,
    p: -1,
    sp: 0,
  }));
  const byName = new Map(chapters.map((c) => [c.name, c]));
  const sp = (name: string) => byName.get(name)?.sp ?? 0;
  let keyframes: { s: number; pos: THREE.Vector3; look: THREE.Vector3; linear: boolean }[] = [];
  let endScroll = Infinity;
  let distScale = 1;

  function layout() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const vh = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
    renderer.setSize(w, h, false);

    const mobile = isMobile();
    camera.aspect = w / h;
    camera.fov = mobile ? 50 : 35;
    distScale = mobile ? 1.5 : 1.12;
    // Pe desktop obiectul stă în dreapta (textul e în stânga); pe mobil, în partea de sus.
    camera.setViewOffset(w, h, mobile ? 0 : -w * 0.17, mobile ? h * 0.15 : 0, w, h);
    camera.updateProjectionMatrix();
    (scene.fog as THREE.Fog).near = mobile ? 10 : 8;
    (scene.fog as THREE.Fog).far = mobile ? 27 : 22;

    keyframes = [];
    for (const c of chapters) {
      c.top = c.el.getBoundingClientRect().top + scrollY;
      c.span = Math.max(c.el.offsetHeight - vh, 1);
      for (const shot of SHOTS[c.name] ?? []) {
        const look = new THREE.Vector3(...shot.look);
        const pos = new THREE.Vector3(...shot.pos).sub(look).multiplyScalar(distScale).add(look);
        keyframes.push({ s: c.top + shot.t * c.span, pos, look, linear: !!shot.linear });
      }
    }
    keyframes.sort((a, b) => a.s - b.s);
    const last = chapters[chapters.length - 1];
    endScroll = last ? last.top + last.el.offsetHeight : Infinity;
  }

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  function cameraAt(s: number) {
    if (!keyframes.length) return;
    let i = 0;
    while (i < keyframes.length - 2 && s > keyframes[i + 1].s) i++;
    const a = keyframes[i];
    const b = keyframes[Math.min(i + 1, keyframes.length - 1)];
    const raw = b.s === a.s ? 1 : THREE.MathUtils.clamp((s - a.s) / (b.s - a.s), 0, 1);
    const u = a.linear && b.linear ? raw : raw * raw * (3 - 2 * raw);
    camPos.lerpVectors(a.pos, b.pos, u);
    camLook.lerpVectors(a.look, b.look, u);
  }

  const ease = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);

  // Scroll-ul netezit: urmărește scroll-ul real cu o mică inerție, fără să-l controleze.
  let smooth = scrollY;
  let last = performance.now();
  let frames = 0;
  let slowFrames = 0;
  let running = true;
  let ready = false;

  function frame(now: number) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const time = now / 1000;

    const target = scrollY;
    smooth += (target - smooth) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - smooth) < 0.1) smooth = target;

    // După secțiunea de programare scena e acoperită complet: nu mai randăm nimic.
    const hidden = smooth > endScroll;
    canvas.parentElement!.classList.toggle('is-hidden', hidden);
    if (hidden && ready) return;

    for (const c of chapters) {
      c.sp = THREE.MathUtils.clamp((smooth - c.top) / c.span, 0, 1);
      // Textul urmează scroll-ul real, ca să nu rămână în urma degetului.
      const p = THREE.MathUtils.clamp((target - c.top) / c.span, 0, 1);
      if (Math.abs(p - c.p) > 0.0005) {
        c.p = p;
        c.el.style.setProperty('--p', p.toFixed(4));
      }
    }

    // ---- Animațiile obiectelor ----
    const pi = sp('intro');
    scissors.setOpen(ease(pi, 0.12, 0.65) * 0.9 + Math.sin(time * 1.4) * 0.03);
    scissors.object.rotation.set(0.15 * (1 - pi), 0.7 * (1 - pi) + Math.sin(time * 0.4) * 0.08, -0.35 * (1 - pi));
    scissors.object.position.y = STATION.scissors[1] + Math.sin(time * 0.9) * 0.06;

    const pc = sp('clipper');
    clipper.object.rotation.set(0.15, -0.6 + pc * Math.PI * 0.9, 0.22 + Math.sin(time * 0.7) * 0.04);
    clipper.object.position.y = STATION.clipper[1] + Math.sin(time * 0.8 + 1) * 0.06;
    clipper.buzz(time, ease(pc, 0.05, 0.2) * (1 - ease(pc, 0.85, 1)));
    comb.object.rotation.y = 0.5 + Math.sin(time * 0.5) * 0.15 + pc * 0.8;

    head.setCut(ease(sp('fade'), 0.06, 0.62));

    const pr = Math.max(sp('razor'), sp('booking') > 0 ? 1 : 0);
    razor.setOpen(ease(pr, 0.1, 0.55));
    razor.object.rotation.set(0.2, -0.4 + pr * 0.9 + Math.sin(time * 0.35) * 0.1, 0.1);
    razor.object.position.y = STATION.razor[1] + Math.sin(time * 0.8 + 2) * 0.06;

    dust.rotation.y = time * 0.01;
    dust.position.y = Math.sin(time * 0.2) * 0.2;

    cameraAt(smooth);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    renderer.render(scene, camera);

    if (!ready) {
      ready = true;
      canvas.parentElement!.classList.add('is-ready');
    }

    // Calitate adaptivă: dacă dispozitivul nu ține pasul, scădem rezoluția o singură dată.
    if (frames < 120) {
      frames++;
      if (dt > 0.028) slowFrames++;
      if (frames === 120 && slowFrames > 40 && maxDpr > 1) {
        maxDpr = 1;
        layout();
      }
    }
  }

  layout();
  new ResizeObserver(layout).observe(canvas);
  // Imaginile/fonturile încărcate târziu pot muta capitolele: remăsurăm.
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  });
  requestAnimationFrame(frame);
}
