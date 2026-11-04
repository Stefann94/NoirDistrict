// Ustensilele construite procedural: zero fișiere de descărcat.
// Când vor exista modele reale (.glb), se înlocuiesc aici, cu aceeași interfață.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  return {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe2e3e8, metalness: 1, roughness: 0.14 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a56b, metalness: 1, roughness: 0.26 }),
    black: new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.35, roughness: 0.5 }),
    gloss: new THREE.MeshStandardMaterial({ color: 0x0e0e10, metalness: 0.7, roughness: 0.2 }),
  };
}

const extrude = (shape: THREE.Shape, depth: number, bevel = 0.012) => {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
};

const shapeFrom = (points: [number, number][], ySign = 1) =>
  new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y * ySign)));

/* ---------------- Foarfecă ---------------- */

export function createScissors(m: Materials) {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.x = -0.35;
  root.add(pivot);

  const halves: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const half = new THREE.Group();

    const blade = new THREE.Shape();
    blade.moveTo(-0.2, 0);
    blade.lineTo(2.3, 0.0);
    blade.quadraticCurveTo(1.3, 0.2 * side, 0.15, 0.16 * side);
    blade.lineTo(-0.2, 0.1 * side);
    blade.closePath();
    half.add(new THREE.Mesh(extrude(blade, 0.04), m.chrome));

    const shank = shapeFrom(
      [
        [0.05, 0.07],
        [-0.98, -0.3],
        [-1.02, -0.44],
        [0.0, -0.09],
      ],
      side,
    );
    half.add(new THREE.Mesh(extrude(shank, 0.05), m.gloss));

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.055, 14, 48), m.gloss);
    ring.position.set(-1.3, -0.5 * side, 0);
    half.add(ring);

    half.position.z = 0.032 * side;
    pivot.add(half);
    halves.push(half);
  }

  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 24), m.gold);
  screw.rotation.x = Math.PI / 2;
  pivot.add(screw);

  return {
    object: root,
    /** 0 = închisă, 1 = deschisă complet. */
    setOpen(t: number) {
      const a = t * 0.48;
      halves[0].rotation.z = a;
      halves[1].rotation.z = -a;
    },
  };
}

/* ---------------- Mașină de tuns ---------------- */

export function createClipper(m: Materials) {
  const root = new THREE.Group();

  const bodyGeo = new RoundedBoxGeometry(0.95, 2.6, 0.7, 5, 0.3);
  // Corp ușor conic spre bază.
  const pos = bodyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const k = 1 - 0.16 * THREE.MathUtils.smoothstep(-y, -1.3, 1.3);
    pos.setX(i, pos.getX(i) * k);
    pos.setZ(i, pos.getZ(i) * (0.94 + 0.06 * k));
  }
  // Normalele rotunjite originale rămân valabile la o conicitate atât de mică;
  // recalcularea lor ar crea muchii vizibile la colțuri.
  root.add(new THREE.Mesh(bodyGeo, m.black));

  // Banda aurie: o felie subțire din corp, ca să urmeze exact colțurile rotunjite.
  const band = new THREE.Mesh(bodyGeo.clone().scale(1.04, 0.04, 1.04), m.gold);
  band.position.y = 0.55;
  root.add(band);

  const lever = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.5, 0.14, 3, 0.045), m.gold);
  lever.position.set(0.45, 0.95, 0);
  root.add(lever);

  const housing = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.32, 0.5, 3, 0.06), m.chrome);
  housing.position.y = 1.42;
  root.add(housing);

  // Două rânduri de dinți: unul fix, unul care vibrează.
  const teethCount = 22;
  const toothGeo = new THREE.BoxGeometry(0.03, 0.22, 0.1);
  const fixed = new THREE.InstancedMesh(toothGeo, m.chrome, teethCount);
  const moving = new THREE.InstancedMesh(toothGeo, m.chrome, teethCount);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < teethCount; i++) {
    const x = -0.5 + (i / (teethCount - 1)) * 1.0;
    mtx.makeTranslation(x, 1.66, 0.08);
    fixed.setMatrixAt(i, mtx);
    mtx.makeTranslation(x, 1.62, -0.06);
    moving.setMatrixAt(i, mtx);
  }
  const movingRow = new THREE.Group();
  movingRow.add(moving);
  root.add(fixed, movingRow);

  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -1.3, 0),
        new THREE.Vector3(0.05, -1.9, 0.1),
        new THREE.Vector3(0.5, -2.4, 0.5),
        new THREE.Vector3(1.3, -2.6, 0.2),
        new THREE.Vector3(1.9, -3.2, -0.4),
      ]),
      64,
      0.05,
      8,
    ),
    m.gloss,
  );
  root.add(cable);

  return {
    object: root,
    /** Vibrația lamei mobile când mașina e „pornită”. */
    buzz(time: number, on: number) {
      movingRow.position.x = Math.sin(time * 95) * 0.012 * on;
    },
  };
}

/* ---------------- Pieptene ---------------- */

export function createComb(m: Materials) {
  const length = 2.4;
  const teeth = 30;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(length, 0);
  shape.lineTo(length, -0.12);
  const step = length / teeth;
  for (let i = teeth - 1; i >= 0; i--) {
    const x = i * step;
    const toothLen = i < teeth / 2 ? 0.42 : 0.34; // dinți rari / dinți deși
    shape.lineTo(x + step * 0.78, -0.12);
    shape.lineTo(x + step * 0.7, -0.12 - toothLen);
    shape.lineTo(x + step * 0.3, -0.12 - toothLen);
    shape.lineTo(x + step * 0.22, -0.12);
  }
  shape.lineTo(0, -0.12);
  shape.closePath();
  const geo = extrude(shape, 0.05, 0.008);
  geo.translate(-length / 2, 0.25, 0);
  return { object: new THREE.Mesh(geo, m.gloss) };
}

/* ---------------- Brici ---------------- */

export function createRazor(m: Materials) {
  const root = new THREE.Group();
  // Mânerul e mutat astfel încât balamaua să fie în origine: deschis, briciul rămâne centrat.
  const body = new THREE.Group();
  const len = 2.6;
  body.position.x = len / 2 - 0.17;
  root.add(body);
  const horn = new THREE.MeshStandardMaterial({ color: 0x1c1510, metalness: 0.45, roughness: 0.24 });

  const scale = new THREE.Shape();
  const r = 0.17;
  scale.moveTo(-len / 2 + r, -r);
  scale.lineTo(len / 2 - r, -r);
  scale.absarc(len / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  scale.lineTo(-len / 2 + r, r);
  scale.absarc(-len / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  const scaleGeo = extrude(scale, 0.035, 0.01);
  for (const z of [0.045, -0.045]) {
    const s = new THREE.Mesh(scaleGeo, horn);
    s.position.z = z;
    body.add(s);
  }
  for (const x of [-len / 2 + 0.17, len / 2 - 0.17]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.15, 16), m.gold);
    pin.rotation.x = Math.PI / 2;
    pin.position.x = x;
    body.add(pin);
  }

  // Lama, articulată în balama (originea).
  const hinge = new THREE.Group();
  root.add(hinge);

  const blade = new THREE.Shape();
  blade.moveTo(-0.35, 0.05); // coada (tang)
  blade.quadraticCurveTo(-0.3, 0.12, -0.05, 0.12);
  blade.lineTo(2.1, 0.12); // muchia
  blade.quadraticCurveTo(2.25, 0.1, 2.25, -0.05);
  blade.lineTo(2.2, -0.28);
  blade.quadraticCurveTo(1.2, -0.36, 0.25, -0.22); // tăișul
  blade.quadraticCurveTo(0.05, -0.16, -0.05, -0.05);
  blade.quadraticCurveTo(-0.25, -0.02, -0.35, 0.05);
  const bladeMesh = new THREE.Mesh(extrude(blade, 0.02, 0.006), m.chrome);
  hinge.add(bladeMesh);

  return {
    object: root,
    /** 0 = închis în mâner, 1 = deschis. */
    setOpen(t: number) {
      hinge.rotation.z = -t * Math.PI * 1.08;
    },
  };
}
