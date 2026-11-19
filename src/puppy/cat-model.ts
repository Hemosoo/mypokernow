import {
  CanvasTexture, CapsuleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  PlaneGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Material, type Object3D,
} from 'three';
import { CAT_COATS, CAT_EYES, COLLARS } from './coats';
import type { Leg, PuppyRig } from './model';

/**
 * A procedurally modelled, rigged cartoon cat on the same joint hierarchy as the
 * puppy (body, four legs, neck, head, jaw, ears, tail), so the same poses, gait and
 * contact solving drive it. It is slimmer and longer, with upright pointed ears,
 * almond eyes with slit pupils, whiskers, a long tail and a bell on its collar.
 *
 * Model space: +z is forward, +y is up, the floor is y = 0. Standing, the cat is
 * about 1.15 units tall to the tips of its ears.
 */
export function buildCat(): PuppyRig {
  const geometries: BufferGeometry[] = [], materials: Material[] = [];
  const geo = <T extends BufferGeometry>(g: T): T => { geometries.push(g); return g; };
  const mat = <T extends Material>(m: T): T => { materials.push(m); return m; };

  const fur = mat(new MeshPhysicalMaterial({ color: '#e9a45c', roughness: 0.8, sheen: 1, sheenColor: new Color('#ffe0b5'), sheenRoughness: 0.45 }));
  const cream = mat(new MeshPhysicalMaterial({ color: '#fff1de', roughness: 0.84, sheen: 1, sheenColor: new Color('#ffffff'), sheenRoughness: 0.55 }));
  const stripe = mat(new MeshPhysicalMaterial({ color: '#b5652b', roughness: 0.82, sheen: 0.8, sheenColor: new Color('#e3a06a'), sheenRoughness: 0.5 }));
  const patchA = mat(new MeshPhysicalMaterial({ color: '#e3924a', roughness: 0.82, sheen: 0.8, sheenColor: new Color('#ffd0a0'), sheenRoughness: 0.5 }));
  const patchB = mat(new MeshPhysicalMaterial({ color: '#2b2624', roughness: 0.82, sheen: 0.8, sheenColor: new Color('#6a625d'), sheenRoughness: 0.5 }));
  const pink = mat(new MeshPhysicalMaterial({ color: '#f2a0a8', roughness: 0.6 }));
  const nose = mat(new MeshPhysicalMaterial({ color: '#e07a88', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  const iris = mat(new MeshPhysicalMaterial({ color: '#86c440', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const pupil = mat(new MeshPhysicalMaterial({ color: '#0d0b0a', roughness: 0.1, clearcoat: 1 }));
  const sparkle = mat(new MeshBasicMaterial({ color: '#ffffff' }));
  const whisker = mat(new MeshBasicMaterial({ color: '#fbf7f0', transparent: true, opacity: 0.85 }));
  const collar = mat(new MeshPhysicalMaterial({ color: COLLARS.sapphire, roughness: 0.45, clearcoat: 0.6 }));
  const gold = mat(new MeshPhysicalMaterial({ color: '#ffcf5a', roughness: 0.22, metalness: 0.9 }));
  const mouthMat = mat(new MeshPhysicalMaterial({ color: '#5a2a2e', roughness: 0.6 }));
  const tongueMat = mat(new MeshPhysicalMaterial({ color: '#ff8fa0', roughness: 0.45, clearcoat: 0.6 }));

  const sphere = geo(new SphereGeometry(1, 28, 20));
  const lowSphere = geo(new SphereGeometry(1, 16, 12));
  const mesh = (geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): Mesh => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    return m;
  };
  const joint = (parent: Object3D, x = 0, y = 0, z = 0): Group => { const g = new Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const stripes: Mesh[] = [], patches: Mesh[] = [], plains: Mesh[] = [];

  const root = new Group();
  root.name = 'cat';

  // ── body: long and lean, a little higher at the hips
  const body = joint(root, 0, 0.4, 0);
  const torso = new Mesh(geo(new CapsuleGeometry(0.2, 0.44, 10, 24)), fur);
  torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1, 0.92); torso.position.set(0, 0.04, -0.03);
  body.add(torso);
  body.add(mesh(sphere, cream, 0, -0.02, 0.2, 0.15, 0.17, 0.13));         // chest bib
  body.add(mesh(lowSphere, cream, 0, -0.13, -0.03, 0.13, 0.07, 0.3));     // belly
  // Tabby bands over the back: half rings around the body's long axis.
  const band = geo(new TorusGeometry(0.205, 0.022, 8, 24, Math.PI));
  for (const z of [-0.26, -0.14, -0.02, 0.1]) {
    const ring = new Mesh(band, stripe);
    ring.position.set(0, 0.04, z); ring.scale.set(1, 1, 0.5);
    body.add(ring); stripes.push(ring);
  }
  // Calico patches.
  const patch = (material: Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): void => {
    const m = mesh(sphere, material, x, y, z, sx, sy, sz); body.add(m); patches.push(m);
  };
  patch(patchA, 0.09, 0.13, -0.12, 0.14, 0.11, 0.2);
  patch(patchB, -0.1, 0.12, 0.06, 0.12, 0.1, 0.14);
  patch(patchA, -0.06, 0.15, -0.3, 0.12, 0.08, 0.12);

  // ── legs: slender, with small round paws
  const leg = (x: number, y: number, z: number, front: boolean): Leg => {
    const hip = joint(body, x, y, z);
    hip.add(mesh(sphere, fur, 0, -0.02, 0, 0.085, 0.1, 0.1));
    const upper = new Mesh(geo(new CapsuleGeometry(0.055, 0.12, 6, 12)), fur);
    upper.position.y = -0.085; hip.add(upper);
    const knee = joint(hip, 0, -0.17, front ? 0.005 : -0.012);
    const lower = new Mesh(geo(new CapsuleGeometry(0.047, 0.1, 6, 12)), front ? cream : fur);
    lower.position.y = -0.06; knee.add(lower);
    const paw = joint(knee, 0, -0.135, 0.02);
    paw.add(mesh(sphere, cream, 0, 0, 0.012, 0.066, 0.045, 0.085));
    for (const tx of [-0.026, 0, 0.026]) paw.add(mesh(lowSphere, pink, tx, -0.026, 0.05, 0.013, 0.009, 0.013));
    return { hip, knee, paw };
  };
  const legs = { fl: leg(-0.11, -0.06, 0.2, true), fr: leg(0.11, -0.06, 0.2, true), bl: leg(-0.115, -0.04, -0.25, false), br: leg(0.115, -0.04, -0.25, false) };

  // ── tail: eight segments, long and thin, ringed on a tabby
  const tail: Group[] = [];
  let parent: Object3D = joint(body, 0, 0.1, -0.46);
  for (let index = 0; index < 8; index++) {
    const radius = 0.045 - index * 0.002;
    const segment = joint(parent, 0, index ? 0.075 : 0, index ? -0.005 : 0);
    const ringed = index % 2 === 1;
    const piece = new Mesh(geo(new CapsuleGeometry(radius, 0.06, 6, 12)), ringed ? stripe : fur);
    piece.position.y = 0.04;
    segment.add(piece);
    if (ringed) { const plain = new Mesh(piece.geometry, fur); plain.position.y = 0.04; plain.visible = false; segment.add(plain); stripes.push(piece); plains.push(plain); }
    tail.push(segment);
    parent = segment;
  }

  // ── head on the neck
  const neck = joint(body, 0, 0.13, 0.3);
  const collarRing = new Mesh(geo(new TorusGeometry(0.125, 0.022, 10, 32)), collar);
  collarRing.rotation.x = Math.PI / 2 - 0.35; collarRing.position.set(0, 0.03, 0);
  neck.add(collarRing);
  const bell = new Group();
  bell.position.set(0, -0.06, 0.125);
  bell.add(mesh(sphere, gold, 0, 0, 0, 0.038, 0.038, 0.038));
  const slot = new Mesh(geo(new CylinderGeometry(0.005, 0.005, 0.06, 6)), pupil);
  slot.rotation.z = Math.PI / 2; slot.position.set(0, -0.012, 0.03); bell.add(slot);
  neck.add(bell);
  const head = joint(neck, 0, 0.22, 0.05);
  head.add(mesh(sphere, fur, 0, 0, 0, 0.25, 0.215, 0.23));
  // Full cheeks give the cat its rounder face.
  head.add(mesh(sphere, fur, -0.1, -0.06, 0.08, 0.13, 0.11, 0.12));
  head.add(mesh(sphere, fur, 0.1, -0.06, 0.08, 0.13, 0.11, 0.12));
  // Whisker pads and chin.
  head.add(mesh(sphere, cream, -0.042, -0.085, 0.19, 0.06, 0.05, 0.05));
  head.add(mesh(sphere, cream, 0.042, -0.085, 0.19, 0.06, 0.05, 0.05));
  const noseMesh = new Mesh(geo(new ConeGeometry(0.03, 0.03, 3)), nose);
  noseMesh.rotation.set(Math.PI / 2, 0, Math.PI); noseMesh.scale.set(1, 1, 0.6); noseMesh.position.set(0, -0.045, 0.232);
  head.add(noseMesh);
  head.add(mesh(lowSphere, mouthMat, 0, -0.112, 0.205, 0.03, 0.01, 0.015));
  // Tabby forehead marks: a few short bars.
  for (const [x, rz] of [[-0.05, 0.25], [0, 0], [0.05, -0.25]] as const) {
    const mark = mesh(lowSphere, stripe, x, 0.13, 0.15, 0.015, 0.055, 0.02); mark.rotation.z = rz; head.add(mark); stripes.push(mark);
  }
  const headPatch = mesh(sphere, patchB, 0.11, 0.07, 0.06, 0.12, 0.12, 0.13); head.add(headPatch); patches.push(headPatch);
  const jaw = joint(head, 0, -0.11, 0.14);
  jaw.add(mesh(sphere, cream, 0, -0.012, 0.035, 0.07, 0.03, 0.065));
  const tongue = mesh(sphere, tongueMat, 0, -0.008, 0.06, 0.035, 0.012, 0.045);
  jaw.add(tongue);
  // Whiskers fan out from the pads.
  const whiskerGeometry = geo(new CylinderGeometry(0.0028, 0.0018, 0.24, 4));
  for (const side of [-1, 1]) {
    for (const [lift, spread] of [[0.03, 0.22], [0, 0.08], [-0.03, -0.08]] as const) {
      const w = new Mesh(whiskerGeometry, whisker);
      w.position.set(side * 0.16, -0.08 + lift, 0.17);
      w.rotation.set(0, side * 0.35, side * (Math.PI / 2 - spread));
      head.add(w);
    }
  }
  // Almond eyes: iris, slit pupil and a catch-light.
  const eyes = [-1, 1].map((side) => {
    const eye = joint(head, side * 0.085, 0.015, 0.185);
    eye.rotation.z = side * -0.18;
    eye.add(mesh(sphere, iris, 0, 0, 0, 0.052, 0.04, 0.03));
    eye.add(mesh(lowSphere, pupil, 0, 0, 0.024, 0.011, 0.034, 0.01));
    eye.add(mesh(lowSphere, sparkle, 0.018, 0.016, 0.028, 0.009, 0.009, 0.004));
    return eye;
  });
  // Upright, pointed ears with a pink inside.
  const earCone = geo(new ConeGeometry(0.085, 0.17, 4, 1));
  const innerCone = geo(new ConeGeometry(0.055, 0.12, 4, 1));
  const ears = [-1, 1].map((side) => {
    const ear = joint(head, side * 0.13, 0.15, -0.01);
    const outer = new Mesh(earCone, fur);
    outer.position.y = 0.07; outer.rotation.set(-0.12, Math.PI / 4, side * -0.22); outer.scale.set(1, 1, 0.55);
    ear.add(outer);
    const inner = new Mesh(innerCone, pink);
    inner.position.set(side * -0.006, 0.06, 0.022); inner.rotation.set(-0.12, Math.PI / 4, side * -0.22); inner.scale.set(1, 1, 0.3);
    ear.add(inner);
    return ear;
  });

  const socket = (parentObject: Object3D, x: number, y: number, z: number): Object3D => joint(parentObject, x, y, z);
  const sockets = {
    nose: socket(head, 0, -0.04, 0.27), mouth: socket(jaw, 0, -0.01, 0.1),
    pawL: socket(legs.fl.paw, 0, -0.035, 0.06), pawR: socket(legs.fr.paw, 0, -0.035, 0.06),
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)'); gradient.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  }
  const shadowTexture = new CanvasTexture(canvas);
  const shadowMat = mat(new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }));
  const shadow = new Mesh(geo(new PlaneGeometry(1.1, 1.3)), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = -1;
  root.add(shadow);

  return {
    kind: 'cat', bodyY: 0.4, height: 1.15,
    root, body, neck, head, jaw, tongue, eyes, ears, tail, legs, shadow, sockets,
    paint(settings) {
      const coat = CAT_COATS[settings.catCoat ?? 'tabby'] ?? CAT_COATS.tabby;
      fur.color.set(coat.fur); fur.sheenColor.set(coat.sheen);
      cream.color.set(coat.cream);
      for (const m of stripes) m.visible = Boolean(coat.stripe);
      // Ringed tail segments carry a plain twin that shows when there are no stripes.
      for (const m of plains) m.visible = !coat.stripe;
      if (coat.stripe) stripe.color.set(coat.stripe);
      for (const m of patches) m.visible = Boolean(coat.patchA);
      if (coat.patchA) patchA.color.set(coat.patchA);
      if (coat.patchB) patchB.color.set(coat.patchB);
      iris.color.set((CAT_EYES[settings.eyes ?? 'green'] ?? CAT_EYES.green).iris);
      collar.color.set(COLLARS[settings.collar ?? 'sapphire'] ?? COLLARS.sapphire);
    },
    dispose() {
      root.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      shadowTexture.dispose();
    },
  };
}
