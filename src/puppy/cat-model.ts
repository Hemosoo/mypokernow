import {
  CanvasTexture, CapsuleGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  PlaneGeometry, SphereGeometry, SRGBColorSpace, TorusGeometry, type BufferGeometry, type Material, type Object3D,
} from 'three';
import { CAT_COATS, CAT_EYES, COLLARS } from './coats';
import type { Leg, PuppyRig } from './model';

/**
 * A procedurally modelled, rigged cartoon cat on the same joint hierarchy as the
 * puppy (body, four legs, neck, head, jaw, ears, tail), so the same poses, gait and
 * contact solving drive it. Like the puppy it has a big round head, big glossy eyes
 * and a small soft body, with upright ears, fluffy cheeks, whiskers, a plump tail
 * and a bell on its collar.
 *
 * Model space: +z is forward, +y is up, the floor is y = 0. Standing, the cat is
 * about 1.2 units tall to the tips of its ears.
 */
/** Smooth 0–1 step. */
const step = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Markings are painted into the fur rather than built from separate shapes, so the
 * cat stays one smooth, soft form. Each canvas multiplies the fur colour: white
 * leaves it as it is, darker paints a stripe or a patch.
 */
interface Coat { fur: string; stripe?: string; patchA?: string; patchB?: string }
function ratio(paint: string, base: string): string {
  const p = new Color(paint), b = new Color(base);
  const c = (x: number, y: number): number => Math.round(Math.min(1, x / Math.max(0.02, y)) * 255);
  return `rgb(${c(p.r, b.r)},${c(p.g, b.g)},${c(p.b, b.b)})`;
}
type Painter = (context: CanvasRenderingContext2D, coat: Coat, size: number) => void;
/** The body: tabby bands over the back that fade towards the belly; calico patches. */
const paintBody: Painter = (c, coat, n) => {
  if (coat.stripe) {
    c.strokeStyle = ratio(coat.stripe, coat.fur); c.lineCap = 'round';
    // u runs round the body (0.5 is the spine), v along it (1 is the shoulders).
    for (const v of [0.22, 0.34, 0.46, 0.58, 0.7]) {
      c.lineWidth = n * 0.06;
      c.beginPath();
      for (let u = 0.12; u <= 0.88; u += 0.02) {
        const y = (1 - v) * n + Math.sin(u * 18) * n * 0.012 + (Math.abs(u - 0.5) * n * 0.06);
        if (u === 0.12) c.moveTo(u * n, y); else c.lineTo(u * n, y);
      }
      c.globalAlpha = 1; c.stroke();
    }
    // Fade the bands away down the flanks.
    for (const [from, to] of [[0, 0.18], [0.82, 1]] as const) {
      const g = c.createLinearGradient(from * n, 0, to * n, 0);
      g.addColorStop(from === 0 ? 0 : 1, '#ffffff'); g.addColorStop(from === 0 ? 1 : 0, 'rgba(255,255,255,0)');
      c.globalAlpha = 1; c.fillStyle = g; c.fillRect(from * n, 0, (to - from) * n, n);
    }
  }
  if (coat.patchA) {
    c.fillStyle = ratio(coat.patchA, coat.fur);
    for (const [u, v, r] of [[0.38, 0.62, 0.12], [0.6, 0.3, 0.1]] as const) { c.beginPath(); c.ellipse(u * n, (1 - v) * n, r * n, r * n * 1.4, 0.4, 0, Math.PI * 2); c.fill(); }
  }
  if (coat.patchB) {
    c.fillStyle = ratio(coat.patchB, coat.fur);
    for (const [u, v, r] of [[0.58, 0.68, 0.09], [0.42, 0.34, 0.07]] as const) { c.beginPath(); c.ellipse(u * n, (1 - v) * n, r * n, r * n * 1.5, -0.3, 0, Math.PI * 2); c.fill(); }
  }
};
/** The head: the tabby's "M" on the forehead and a stripe across each cheek; a calico's patch over one ear. */
const paintHead: Painter = (c, coat, n) => {
  // u = 0.25 faces forward, v = 1 is the crown.
  if (coat.stripe) {
    c.strokeStyle = ratio(coat.stripe, coat.fur); c.lineCap = 'round'; c.lineWidth = n * 0.016;
    for (const [u, lean] of [[0.215, -0.012], [0.238, -0.004], [0.262, 0.004], [0.285, 0.012]] as const) {
      c.beginPath(); c.moveTo(u * n, (1 - 0.92) * n); c.lineTo((u + lean) * n, (1 - 0.78) * n); c.stroke();
    }
    c.lineWidth = n * 0.014;
    for (const u of [0.1, 0.4]) for (const v of [0.47, 0.42]) { c.beginPath(); c.moveTo((u - 0.035) * n, (1 - v) * n); c.lineTo((u + 0.035) * n, (1 - v + 0.012) * n); c.stroke(); }
    c.lineWidth = n * 0.03;
    for (const u of [0.66, 0.75, 0.84]) { c.beginPath(); c.moveTo(u * n, (1 - 0.95) * n); c.lineTo(u * n, (1 - 0.72) * n); c.stroke(); }
  }
  if (coat.patchB) { c.fillStyle = ratio(coat.patchB, coat.fur); c.beginPath(); c.ellipse(0.4 * n, (1 - 0.78) * n, 0.11 * n, 0.2 * n, 0, 0, Math.PI * 2); c.fill(); }
  if (coat.patchA) { c.fillStyle = ratio(coat.patchA, coat.fur); c.beginPath(); c.ellipse(0.08 * n, (1 - 0.74) * n, 0.1 * n, 0.18 * n, 0, 0, Math.PI * 2); c.fill(); }
};
/** The tail: one soft ring on each segment of a tabby's tail. */
const paintTail: Painter = (c, coat, n) => {
  if (!coat.stripe) return;
  c.fillStyle = ratio(coat.stripe, coat.fur);
  c.fillRect(0, 0.4 * n, n, 0.22 * n);
};

/** A sphere pushed out at the cheeks and flattened under the chin: one smooth head. */
function headGeometry(): SphereGeometry {
  const g = new SphereGeometry(1, 48, 36), p = g.attributes.position!;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cheek = step(0.4, -0.3, y) * (1 - 0.6 * step(-0.6, -1, y));
    p.setXYZ(i, x * (1 + 0.17 * cheek), y < -0.7 ? -0.7 + (y + 0.7) * 0.85 : y, z * (1 + 0.05 * cheek));
  }
  g.computeVertexNormals();
  return g;
}

export function buildCat(): PuppyRig {
  const geometries: BufferGeometry[] = [], materials: Material[] = [], textures: CanvasTexture[] = [];
  const geo = <T extends BufferGeometry>(g: T): T => { geometries.push(g); return g; };
  const mat = <T extends Material>(m: T): T => { materials.push(m); return m; };
  const canvas = (painter: Painter) => {
    const element = document.createElement('canvas'); element.width = element.height = 256;
    const texture = new CanvasTexture(element); texture.colorSpace = SRGBColorSpace; textures.push(texture);
    return { texture, paint: (coat: Coat): void => {
      const context = element.getContext('2d');
      if (!context) return;
      context.globalAlpha = 1; context.fillStyle = '#ffffff'; context.fillRect(0, 0, 256, 256);
      context.filter = 'blur(2px)';
      painter(context, coat, 256);
      context.filter = 'none';
      texture.needsUpdate = true;
    } };
  };
  const bodyPaint = canvas(paintBody), headPaint = canvas(paintHead), tailPaint = canvas(paintTail);
  const furOf = (map: CanvasTexture) => mat(new MeshPhysicalMaterial({ color: '#8b8e96', map, roughness: 0.82, sheen: 1, sheenColor: new Color('#e6e9ef'), sheenRoughness: 0.45 }));
  const fur = furOf(bodyPaint.texture), headFur = furOf(headPaint.texture), tailFur = furOf(tailPaint.texture);
  const plainFur = mat(new MeshPhysicalMaterial({ color: '#8b8e96', roughness: 0.82, sheen: 1, sheenColor: new Color('#e6e9ef'), sheenRoughness: 0.45 }));
  const cream = mat(new MeshPhysicalMaterial({ color: '#efece7', roughness: 0.84, sheen: 1, sheenColor: new Color('#ffffff'), sheenRoughness: 0.55 }));
  const pink = mat(new MeshPhysicalMaterial({ color: '#f2a0a8', roughness: 0.6 }));
  const nose = mat(new MeshPhysicalMaterial({ color: '#e07a88', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  const iris = mat(new MeshPhysicalMaterial({ color: '#e8a72a', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const pupil = mat(new MeshPhysicalMaterial({ color: '#0d0b0a', roughness: 0.1, clearcoat: 1 }));
  const sparkle = mat(new MeshBasicMaterial({ color: '#ffffff' }));
  const whisker = mat(new MeshBasicMaterial({ color: '#fbf7f0', transparent: true, opacity: 0.85 }));
  const collar = mat(new MeshPhysicalMaterial({ color: COLLARS.sapphire, roughness: 0.45, clearcoat: 0.6 }));
  const gold = mat(new MeshPhysicalMaterial({ color: '#ffcf5a', roughness: 0.22, metalness: 0.9 }));
  const mouthMat = mat(new MeshPhysicalMaterial({ color: '#5a2a2e', roughness: 0.6 }));
  const tongueMat = mat(new MeshPhysicalMaterial({ color: '#ff8fa0', roughness: 0.45, clearcoat: 0.6 }));
  const blush = mat(new MeshBasicMaterial({ color: '#ff9fb0', transparent: true, opacity: 0.32, depthWrite: false }));

  const sphere = geo(new SphereGeometry(1, 32, 24));
  const lowSphere = geo(new SphereGeometry(1, 16, 12));
  const mesh = (geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): Mesh => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    return m;
  };
  const joint = (parent: Object3D, x = 0, y = 0, z = 0): Group => { const g = new Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new Group();
  root.name = 'cat';

  // ── body: one soft loaf, a little fuller at the haunches
  const body = joint(root, 0, 0.34, 0);
  const torsoGeometry = geo(new CapsuleGeometry(0.21, 0.28, 14, 32));
  { const p = torsoGeometry.attributes.position!; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 + 0.1 * step(0.05, -0.3, y); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (1 + 0.04 * step(0.05, -0.3, y))); } torsoGeometry.computeVertexNormals(); }
  const torso = new Mesh(torsoGeometry, fur);
  torso.rotation.x = Math.PI / 2; torso.position.set(0, 0.05, -0.03);
  body.add(torso);
  body.add(mesh(sphere, cream, 0, 0.01, 0.16, 0.15, 0.17, 0.12));          // chest ruff, sunk into the body
  body.add(mesh(lowSphere, cream, 0, -0.11, -0.02, 0.15, 0.08, 0.24));     // belly

  // ── legs: short and rounded, the same fur all the way down to white mitten paws
  const leg = (x: number, y: number, z: number, front: boolean): Leg => {
    const hip = joint(body, x, y, z);
    hip.add(mesh(sphere, plainFur, front ? -Math.sign(x) * 0.012 : 0, front ? 0.01 : 0.01, front ? -0.02 : 0, front ? 0.075 : 0.12, front ? 0.09 : 0.13, front ? 0.08 : 0.13));
    const upper = new Mesh(geo(new CapsuleGeometry(0.06, 0.07, 8, 16)), plainFur);
    upper.position.y = -0.065; hip.add(upper);
    const knee = joint(hip, 0, -0.13, front ? 0.005 : -0.01);
    knee.add(mesh(lowSphere, plainFur, 0, 0, 0, 0.06, 0.06, 0.06));
    const lower = new Mesh(geo(new CapsuleGeometry(0.056, 0.05, 8, 16)), plainFur);
    lower.position.y = -0.045; knee.add(lower);
    const paw = joint(knee, 0, -0.1, 0.02);
    paw.add(mesh(sphere, cream, 0, 0, 0.012, 0.074, 0.052, 0.09));
    for (const tx of [-0.03, 0, 0.03]) paw.add(mesh(lowSphere, pink, tx, -0.032, 0.055, 0.015, 0.01, 0.015));
    return { hip, knee, paw };
  };
  const legs = { fl: leg(-0.11, -0.07, 0.17, true), fr: leg(0.11, -0.07, 0.17, true), bl: leg(-0.12, -0.05, -0.19, false), br: leg(0.12, -0.05, -0.19, false) };

  // ── tail: seven overlapping segments of one even taper, so it reads as one tail
  const tail: Group[] = [];
  let parent: Object3D = joint(body, 0, 0.1, -0.37);
  for (let index = 0; index < 7; index++) {
    const radius = 0.056 - index * 0.0025;
    const segment = joint(parent, 0, index ? 0.072 : 0, index ? -0.003 : 0);
    const piece = new Mesh(geo(new CapsuleGeometry(radius, 0.06, 8, 16)), tailFur);
    piece.position.y = 0.04;
    segment.add(piece);
    tail.push(segment);
    parent = segment;
  }
  // A rounded tip.
  tail[tail.length - 1]!.add(mesh(lowSphere, tailFur, 0, 0.095, 0, 0.042, 0.05, 0.042));

  // ── a big round head on the neck, sculpted wider at the cheeks
  const neck = joint(body, 0, 0.15, 0.25);
  const collarRing = new Mesh(geo(new TorusGeometry(0.14, 0.024, 10, 32)), collar);
  collarRing.rotation.x = Math.PI / 2 - 0.35; collarRing.position.set(0, 0.03, 0);
  neck.add(collarRing);
  const bell = new Group();
  bell.position.set(0, -0.065, 0.14);
  bell.add(mesh(sphere, gold, 0, 0, 0, 0.042, 0.042, 0.042));
  const slot = new Mesh(geo(new CylinderGeometry(0.006, 0.006, 0.066, 6)), pupil);
  slot.rotation.z = Math.PI / 2; slot.position.set(0, -0.014, 0.034); bell.add(slot);
  neck.add(bell);
  const head = joint(neck, 0, 0.26, 0.05);
  head.add(mesh(geo(headGeometry()), headFur, 0, 0, 0, 0.31, 0.28, 0.29));
  // Little whisker pads and chin, low on the face so the eyes stay big.
  head.add(mesh(sphere, cream, -0.048, -0.11, 0.24, 0.07, 0.055, 0.052));
  head.add(mesh(sphere, cream, 0.048, -0.11, 0.24, 0.07, 0.055, 0.052));
  const noseMesh = new Mesh(geo(new ConeGeometry(0.032, 0.03, 3)), nose);
  noseMesh.rotation.set(Math.PI / 2, 0, Math.PI); noseMesh.scale.set(1, 1, 0.6); noseMesh.position.set(0, -0.068, 0.29);
  head.add(noseMesh);
  // A small "w" mouth under the nose.
  for (const side of [-1, 1]) { const lip = mesh(lowSphere, mouthMat, side * 0.022, -0.11, 0.286, 0.024, 0.008, 0.01); lip.rotation.z = side * 0.45; head.add(lip); }
  for (const side of [-1, 1]) {
    const cheek = new Mesh(geo(new CircleGeometry(0.05, 20)), blush);
    cheek.position.set(side * 0.205, -0.075, 0.2); cheek.rotation.y = side * 0.8;
    head.add(cheek);
  }
  const jaw = joint(head, 0, -0.135, 0.19);
  jaw.add(mesh(sphere, cream, 0, -0.012, 0.04, 0.075, 0.03, 0.065));
  const tongue = mesh(sphere, tongueMat, 0, -0.008, 0.065, 0.035, 0.012, 0.045);
  jaw.add(tongue);
  const whiskerGeometry = geo(new CylinderGeometry(0.0025, 0.0015, 0.2, 4));
  for (const side of [-1, 1]) {
    for (const [lift, spread] of [[0.012, 0.16], [-0.016, -0.04]] as const) {
      const w = new Mesh(whiskerGeometry, whisker);
      w.position.set(side * 0.16, -0.105 + lift, 0.21);
      w.rotation.set(0, side * 0.4, side * (Math.PI / 2 - spread));
      head.add(w);
    }
  }
  // Big round eyes: a coloured iris, a wide pupil and two catch-lights.
  const eyes = [-1, 1].map((side) => {
    const eye = joint(head, side * 0.122, 0.025, 0.232);
    eye.add(mesh(sphere, iris, 0, 0, 0, 0.078, 0.088, 0.05));
    eye.add(mesh(lowSphere, pupil, 0, -0.004, 0.03, 0.05, 0.066, 0.03));
    eye.add(mesh(lowSphere, sparkle, 0.026, 0.032, 0.054, 0.022, 0.024, 0.01));
    eye.add(mesh(lowSphere, sparkle, -0.02, -0.03, 0.056, 0.01, 0.01, 0.006));
    return eye;
  });
  // Closed eyes, for sleep: a soft curve where each eye was.
  const lidGeometry = geo(new TorusGeometry(0.052, 0.011, 8, 20, Math.PI * 0.9));
  const lidMat = mat(new MeshBasicMaterial({ color: '#3a2a2e' }));
  const lids = [-1, 1].map((side) => {
    const lid = new Mesh(lidGeometry, lidMat);
    lid.position.set(side * 0.122, 0.035, 0.262); lid.rotation.set(-0.15, side * 0.32, Math.PI + Math.PI * 0.05);
    lid.visible = false; head.add(lid);
    return lid;
  });
  // Big upright ears, rounded at the tip, with a pink inside.
  const earCone = geo(new ConeGeometry(0.11, 0.2, 24, 3));
  const innerCone = geo(new ConeGeometry(0.07, 0.14, 24, 2));
  const ears = [-1, 1].map((side) => {
    const ear = joint(head, side * 0.18, 0.18, -0.02);
    const outer = new Mesh(earCone, plainFur);
    outer.position.y = 0.08; outer.rotation.set(-0.1, 0, side * -0.38); outer.scale.set(1, 1, 0.55);
    ear.add(outer);
    const inner = new Mesh(innerCone, pink);
    inner.position.set(side * -0.012, 0.068, 0.03); inner.rotation.set(-0.1, 0, side * -0.38); inner.scale.set(1, 1, 0.3);
    ear.add(inner);
    return ear;
  });

  const socket = (parentObject: Object3D, x: number, y: number, z: number): Object3D => joint(parentObject, x, y, z);
  const sockets = {
    nose: socket(head, 0, -0.07, 0.32), mouth: socket(jaw, 0, -0.01, 0.1),
    pawL: socket(legs.fl.paw, 0, -0.035, 0.06), pawR: socket(legs.fr.paw, 0, -0.035, 0.06),
  };

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)'); gradient.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  }
  const shadowTexture = new CanvasTexture(shadowCanvas);
  const shadowMat = mat(new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  const shadow = new Mesh(geo(new PlaneGeometry(1.1, 1.3)), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = -1;
  root.add(shadow);

  return {
    kind: 'cat', bodyY: 0.34, height: 1.18,
    root, body, neck, head, jaw, tongue, eyes, lids, ears, tail, legs, shadow, sockets,
    paint(settings) {
      const coat = CAT_COATS[settings.catCoat ?? 'grey'] ?? CAT_COATS.grey;
      for (const m of [fur, headFur, tailFur, plainFur]) { m.color.set(coat.fur); m.sheenColor.set(coat.sheen); }
      cream.color.set(coat.cream); cream.sheenColor.set(coat.creamSheen ?? '#ffffff');
      // Closed eyes are drawn dark on a light coat and light on a dark one.
      lidMat.color.set(new Color(coat.fur).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25 ? '#a39eab' : '#3a2a2e');
      bodyPaint.paint(coat); headPaint.paint(coat); tailPaint.paint(coat);
      iris.color.set((CAT_EYES[settings.eyes ?? 'amber'] ?? CAT_EYES.amber).iris);
      collar.color.set(COLLARS[settings.collar ?? 'sapphire'] ?? COLLARS.sapphire);
    },
    dispose() {
      root.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      shadowTexture.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
