// Foarfecă de frizerie construită din cod: zero fișiere de descărcat.
// Crom pe lame, negru lucios pe mânere, ca paleta site-ului. Pivotul e în originea grupului `pivot`.
import * as THREE from 'three';

const extrude = (shape: THREE.Shape, depth: number, bevel: number) => {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 32,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
};

const tube = (points: [number, number][], radius: number) => {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  const geo = new THREE.TubeGeometry(curve, 48, radius, 14);
  geo.scale(1, 1, 0.7); // secțiune ovală, ca la mânerele turnate
  return geo;
};

export function createShears() {
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xf3f3f5,
    metalness: 1,
    roughness: 0.07,
    clearcoat: 0.4,
    clearcoatRoughness: 0.05,
  });
  const black = new THREE.MeshPhysicalMaterial({
    color: 0x18181a,
    metalness: 0.85,
    roughness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
  });

  const object = new THREE.Group();
  const pivot = new THREE.Group();
  // Lungimea totală e cam de la x=-2.65 la x=3.1: centrăm obiectul.
  pivot.position.x = -0.22;
  object.add(pivot);

  const halves: THREE.Group[] = [];
  // `s` = partea pe care stă lama. Mânerul fiecărei jumătăți e pe partea opusă (se încrucișează în pivot).
  for (const s of [1, -1]) {
    const half = new THREE.Group();

    // Lama: tăișul drept pe y≈0, cotorul curbat spre vârf.
    const blade = new THREE.Shape();
    blade.moveTo(-0.3, -0.02 * s);
    blade.lineTo(2.95, -0.004 * s);
    blade.quadraticCurveTo(3.12, 0.004 * s, 3.03, 0.05 * s);
    blade.bezierCurveTo(2.3, 0.13 * s, 1.0, 0.25 * s, 0.15, 0.27 * s);
    blade.quadraticCurveTo(-0.24, 0.27 * s, -0.3, 0.1 * s);
    blade.closePath();
    half.add(new THREE.Mesh(extrude(blade, 0.026, 0.012), chrome));

    // Discul din jurul pivotului
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.05, 48), chrome);
    boss.rotation.x = Math.PI / 2;
    half.add(boss);

    // Brațul spre inel și inelul. Jumătatea cu s=1 are brațul lung și sprijinul pentru deget.
    const long = s === 1;
    const ring = long ? { x: -1.86, y: -0.64, r: 0.34 } : { x: -1.58, y: 0.56, r: 0.3 };
    half.add(
      new THREE.Mesh(
        tube(
          [
            [-0.05, -0.06 * s],
            [-0.5, -0.2 * s],
            [ring.x * 0.62, ring.y * 0.72],
            [ring.x + ring.r * 0.95, ring.y * 0.98],
          ],
          0.075,
        ),
        black,
      ),
    );
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(ring.r, 0.07, 18, 72), black);
    ringMesh.position.set(ring.x, ring.y, 0);
    ringMesh.scale.set(1.12, 0.9, 0.75);
    half.add(ringMesh);

    if (long) {
      const tang = new THREE.Mesh(
        tube(
          [
            [ring.x - 0.22, ring.y - 0.22],
            [ring.x - 0.48, ring.y - 0.44],
            [ring.x - 0.7, ring.y - 0.52],
            [ring.x - 0.82, ring.y - 0.44],
          ],
          0.045,
        ),
        black,
      );
      half.add(tang);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 14), black);
      tip.position.set(ring.x - 0.82, ring.y - 0.44, 0);
      half.add(tip);
    }

    half.position.z = 0.03 * s;
    pivot.add(half);
    halves.push(half);
  }

  // Șurubul, cu fantă
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.16, 40), chrome);
  screw.rotation.x = Math.PI / 2;
  pivot.add(screw);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.024, 0.02), black);
  slot.position.z = 0.081;
  pivot.add(slot);

  return {
    object,
    pivot,
    /** 0 = închisă, 1 = deschisă complet. */
    setOpen(t: number) {
      const a = t * 0.42;
      halves[0].rotation.z = a;
      halves[1].rotation.z = -a;
    },
  };
}
