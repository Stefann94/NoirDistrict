// Bust de ceramică cu păr din fire individuale. Fade-ul se calculează pe placa video:
// un singur uniform (`uCut`) urcă de la ceafă spre creștet și scurtează firele de sub el.
// Când vor exista filmările reale 360°, scena asta poate fi înlocuită cu secvența de cadre.
import * as THREE from 'three';
import type { Materials } from './models';

// Profilul capului (rază, înălțime), rotit în jurul axei Y.
const PROFILE: [number, number][] = [
  [0.5, -1.9],
  [0.38, -1.72],
  [0.34, -1.4],
  [0.37, -1.02],
  [0.5, -0.86],
  [0.66, -0.58],
  [0.78, -0.22],
  [0.85, 0.15],
  [0.87, 0.5],
  [0.8, 0.86],
  [0.62, 1.13],
  [0.34, 1.29],
  [0.001, 1.34],
];
const SX = 0.88; // îngustare laterală
const SZ = 1.08; // adâncime față-spate

const radiusAt = (y: number) => {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [r0, y0] = PROFILE[i];
    const [r1, y1] = PROFILE[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
};

/** Linia părului în funcție de unghi: sus pe frunte, coboară la tâmple, jos la ceafă. */
const hairlineAt = (phi: number) => {
  const front = Math.sin(phi); // +1 = fața (+z), -1 = ceafa
  return front > 0 ? -0.1 + 0.85 * Math.pow(front, 3) : -0.1 - 0.42 * -front;
};

const CUT_FROM = -0.62;
const CUT_TO = 0.78;

export function createHead(m: Materials, strands: number) {
  const root = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({ color: 0x8c847b, metalness: 0.05, roughness: 0.55 });

  const bustGeo = new THREE.LatheGeometry(
    PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
    96,
  );
  bustGeo.scale(SX, 1, SZ);
  root.add(new THREE.Mesh(bustGeo, ceramic));

  // Trăsături minime, ca să se citească fața, profilul și urechile (fade-ul se face în jurul lor).
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), ceramic);
  nose.scale.set(0.08, 0.19, 0.1);
  nose.position.set(0, 0.02, radiusAt(0.02) * SZ - 0.01);
  nose.rotation.x = -0.3;
  root.add(nose);
  for (const side of [1, -1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), ceramic);
    ear.scale.set(0.05, 0.2, 0.11);
    ear.position.set(side * (radiusAt(0.12) * SX - 0.02), 0.1, -0.06);
    ear.rotation.y = side * -0.3;
    root.add(ear);
  }

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.42, 48), m.black);
  plinth.position.y = -2.11;
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.05, 48), m.gold);
  rim.position.y = -1.88;
  root.add(plinth, rim);

  // ---- Firele de păr ----
  const strandGeo = new THREE.ConeGeometry(0.016, 1, 3, 1, true);
  strandGeo.translate(0, 0.5, 0);

  const cut = { value: CUT_FROM };
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.42 });
  hairMat.onBeforeCompile = (shader) => {
    shader.uniforms.uCut = cut;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aHair;\nuniform float uCut;')
      .replace(
        '#include <begin_vertex>',
        [
          'vec3 transformed = vec3( position );',
          // aHair = (înălțimea rădăcinii, lungime netunsă, lungime după fade)
          'float hairLen = mix( aHair.z, aHair.y, smoothstep( uCut - 0.06, uCut + 0.06, aHair.x ) );',
          'transformed.y *= hairLen;',
          'transformed.xz *= 0.5 + 0.5 * clamp( hairLen * 8.0, 0.0, 1.0 );',
        ].join('\n'),
      );
  };

  const hair = new THREE.InstancedMesh(strandGeo, hairMat, strands);
  const aHair = new Float32Array(strands * 3);
  const up = new THREE.Vector3(0, 1, 0);
  const down = new THREE.Vector3(0, -1, 0);
  const back = new THREE.Vector3(0, 0, -1);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tDown = new THREE.Vector3();
  const tBack = new THREE.Vector3();
  const jitter = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const mtx = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const color = new THREE.Color();
  const rand = mulberry32(7);
  // Proiecția pe suprafață. În creștet „în jos” devine aproape zero: îl lăsăm zero, nu NaN.
  const tangent = (out: THREE.Vector3, v: THREE.Vector3) => {
    out.copy(v).addScaledVector(n, -v.dot(n));
    const len = out.length();
    return len < 1e-3 ? out.set(0, 0, 0) : out.divideScalar(len);
  };

  let placed = 0;
  while (placed < strands) {
    const y = -0.56 + rand() * 1.9;
    const phi = rand() * Math.PI * 2;
    if (y < hairlineAt(phi)) continue;
    const r = radiusAt(y);
    // Distribuție uniformă pe suprafață: acceptăm proporțional cu circumferința.
    if (rand() > r / 0.87) continue;

    const dy = 0.02;
    const slope = (radiusAt(y + dy) - radiusAt(y - dy)) / (2 * dy);
    p.set(Math.cos(phi) * r * SX, y, Math.sin(phi) * r * SZ);
    n.set(Math.cos(phi) / SX, -slope, Math.sin(phi) / SZ).normalize();
    tangent(tDown, down);
    tangent(tBack, back);

    const top = THREE.MathUtils.smoothstep(y, 0.62, 0.95);
    const front = Math.max(0, Math.sin(phi));
    jitter.set(rand() - 0.5, rand() - 0.5, rand() - 0.5);
    // Părul stă culcat pe cap: în jos pe laterale, pieptănat spre spate pe creștet, cu volum în față.
    // Pe frunte nu cade în ochi: acolo e întors spre spate.
    const forehead = front * THREE.MathUtils.smoothstep(y, 0.2, 0.7);
    dir
      .copy(n)
      .multiplyScalar(0.28 + top * (0.15 + front * 0.45))
      .addScaledVector(tDown, (1 - top) * (1 - forehead))
      .addScaledVector(tBack, 0.25 + top + forehead * 1.2)
      .addScaledVector(jitter, 0.3)
      .normalize();

    q.setFromUnitVectors(up, dir);
    mtx.compose(p.addScaledVector(n, -0.006), q, one);
    hair.setMatrixAt(placed, mtx);

    const variance = 0.85 + rand() * 0.3;
    const uncut = (0.17 + top * 0.2 + top * front * 0.12) * variance;
    const faded = top > 0.5 ? uncut : THREE.MathUtils.lerp(0.006, 0.12, THREE.MathUtils.smoothstep(y, -0.5, 0.7)) * variance;
    aHair.set([y, uncut, faded], placed * 3);

    color.setHSL(0.06, 0.3, 0.018 + rand() * 0.03);
    hair.setColorAt(placed, color);
    placed++;
  }
  strandGeo.setAttribute('aHair', new THREE.InstancedBufferAttribute(aHair, 3));
  root.add(hair);

  // Linia aurie care marchează unde trece mașina.
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xe8c48a, transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 6, 120), ringMat);
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  return {
    object: root,
    /** 0 = netuns, 1 = fade complet. */
    setCut(t: number) {
      const y = THREE.MathUtils.lerp(CUT_FROM, CUT_TO, t);
      cut.value = y;
      const r = Math.max(radiusAt(y), 0.3) + 0.06;
      ring.position.y = y;
      ring.scale.set(r * SX, r * SZ, 1);
      ringMat.opacity = Math.min(t * 12, (1 - t) * 12, 1) * 0.9;
    },
  };
}

/** Generator determinist: părul arată la fel la fiecare încărcare. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
