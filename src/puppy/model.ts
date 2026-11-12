import {
  CanvasTexture, CapsuleGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  PlaneGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Material, type Object3D,
} from 'three';

/**
 * A procedurally modelled, rigged cartoon puppy. Every part is a smooth primitive
 * on a joint hierarchy, so animation is a matter of rotating joints: no external
 * model or texture files, nothing to license, a few kilobytes of code.
 *
 * Model space: +z is forward (the face), +y is up, the floor is y = 0. Standing,
 * the puppy is about 1.3 units tall to the top of its head.
 */
export interface Leg { hip: Group; knee: Group; paw: Group }
export interface PuppyRig {
  root: Group;
  /** Hips pivot: bob, squash, lean, sit. */
  body: Group;
  neck: Group;
  head: Group;
  jaw: Group;
  tongue: Mesh;
  eyes: Group[];
  ears: Group[];
  tail: Group[];
  legs: { fl: Leg; fr: Leg; bl: Leg; br: Leg };
  shadow: Mesh;
  /** Joints the brain reads world positions from. */
  sockets: { nose: Object3D; mouth: Object3D; pawL: Object3D; pawR: Object3D };
  dispose(): void;
}

export const PALETTE = {
  fur: '#e2a15c', furDeep: '#c9843f', cream: '#fff2dc', ear: '#9c5a33', nose: '#2a1c18', eye: '#1c120e',
  collar: '#d8475f', tag: '#ffcf5a', tongue: '#ff7f95', blush: '#ff9fa8', mouth: '#5a2a26',
};

export function buildPuppy(): PuppyRig {
  const geometries: BufferGeometry[] = [], materials: Material[] = [];
  const geo = <T extends BufferGeometry>(g: T): T => { geometries.push(g); return g; };
  const mat = <T extends Material>(m: T): T => { materials.push(m); return m; };

  // Velvety fur: a soft sheen at grazing angles reads as short fur at this size.
  const fur = mat(new MeshPhysicalMaterial({ color: PALETTE.fur, roughness: 0.78, sheen: 1, sheenColor: new Color('#ffe2b8'), sheenRoughness: 0.5 }));
  const cream = mat(new MeshPhysicalMaterial({ color: PALETTE.cream, roughness: 0.82, sheen: 1, sheenColor: new Color('#ffffff'), sheenRoughness: 0.55 }));
  const earFur = mat(new MeshPhysicalMaterial({ color: PALETTE.ear, roughness: 0.8, sheen: 1, sheenColor: new Color('#e0a77a'), sheenRoughness: 0.5 }));
  const glossy = mat(new MeshPhysicalMaterial({ color: PALETTE.nose, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 }));
  const eyeMat = mat(new MeshPhysicalMaterial({ color: PALETTE.eye, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
  const sparkle = mat(new MeshBasicMaterial({ color: '#ffffff' }));
  const collar = mat(new MeshPhysicalMaterial({ color: PALETTE.collar, roughness: 0.45, clearcoat: 0.6 }));
  const gold = mat(new MeshPhysicalMaterial({ color: PALETTE.tag, roughness: 0.25, metalness: 0.85 }));
  const tongueMat = mat(new MeshPhysicalMaterial({ color: PALETTE.tongue, roughness: 0.45, clearcoat: 0.6 }));
  const mouthMat = mat(new MeshPhysicalMaterial({ color: PALETTE.mouth, roughness: 0.6 }));
  const blush = mat(new MeshBasicMaterial({ color: PALETTE.blush, transparent: true, opacity: 0.38, depthWrite: false }));

  const sphere = geo(new SphereGeometry(1, 28, 20));
  const lowSphere = geo(new SphereGeometry(1, 18, 12));
  const mesh = (geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): Mesh => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    return m;
  };
  const joint = (parent: Object3D, x = 0, y = 0, z = 0): Group => { const g = new Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const root = new Group();
  root.name = 'puppy';

  // ── body
  const body = joint(root, 0, 0.44, 0);
  const torso = new Mesh(geo(new CapsuleGeometry(0.27, 0.34, 10, 24)), fur);
  torso.rotation.x = Math.PI / 2; torso.scale.set(1, 1, 0.9); torso.position.set(0, 0.05, -0.02);
  body.add(torso);
  body.add(mesh(sphere, cream, 0, -0.01, 0.21, 0.2, 0.22, 0.17));          // chest bib
  body.add(mesh(lowSphere, cream, 0, -0.17, -0.02, 0.17, 0.08, 0.3));       // belly
  body.add(mesh(lowSphere, fur, 0, 0.2, -0.14, 0.2, 0.12, 0.26));           // back

  // ── legs: hip → knee → paw, with white socks
  const leg = (x: number, y: number, z: number, front: boolean): Leg => {
    const hip = joint(body, x, y, z);
    hip.add(mesh(sphere, fur, 0, -0.03, 0, 0.11, 0.12, 0.12));
    const upper = new Mesh(geo(new CapsuleGeometry(0.075, 0.1, 6, 14)), fur);
    upper.position.y = -0.08; hip.add(upper);
    const knee = joint(hip, 0, -0.16, front ? 0.005 : -0.01);
    const lower = new Mesh(geo(new CapsuleGeometry(0.066, 0.07, 6, 14)), cream);
    lower.position.y = -0.055; knee.add(lower);
    const paw = joint(knee, 0, -0.135, 0.025);
    paw.add(mesh(sphere, cream, 0, 0, 0.012, 0.092, 0.06, 0.115));
    // Little toe beans on the sole, seen when a paw is raised.
    for (const tx of [-0.035, 0, 0.035]) paw.add(mesh(lowSphere, earFur, tx, -0.035, 0.07, 0.018, 0.012, 0.018));
    return { hip, knee, paw };
  };
  const legs = { fl: leg(-0.15, -0.07, 0.2, true), fr: leg(0.15, -0.07, 0.2, true), bl: leg(-0.155, -0.06, -0.21, false), br: leg(0.155, -0.06, -0.21, false) };

  // ── tail: five segments curling up, tipped in cream
  const tail: Group[] = [];
  let parent: Object3D = joint(body, 0, 0.12, -0.42);
  [0.062, 0.056, 0.05, 0.045, 0.042].forEach((radius, index) => {
    const segment = joint(parent, 0, index ? 0.06 : 0, index ? -0.012 : 0);
    const piece = new Mesh(geo(new CapsuleGeometry(radius, 0.05, 6, 12)), index === 4 ? cream : fur);
    piece.position.y = 0.035;
    segment.add(piece);
    tail.push(segment);
    parent = segment;
  });

  // ── head on the neck
  const neck = joint(body, 0, 0.17, 0.26);
  const collarRing = new Mesh(geo(new TorusGeometry(0.17, 0.032, 10, 32)), collar);
  collarRing.rotation.x = Math.PI / 2 - 0.35; collarRing.position.set(0, 0.04, 0.0);
  neck.add(collarRing);
  const tag = new Mesh(geo(new CylinderGeometry(0.045, 0.045, 0.014, 20)), gold);
  tag.rotation.x = Math.PI / 2 - 0.3; tag.position.set(0, -0.04, 0.17);
  neck.add(tag);
  const head = joint(neck, 0, 0.27, 0.06);
  head.add(mesh(sphere, fur, 0, 0, 0, 0.34, 0.31, 0.32));
  head.add(mesh(lowSphere, fur, 0, 0.1, -0.06, 0.26, 0.2, 0.24));            // crown
  head.add(mesh(sphere, cream, 0, -0.1, 0.22, 0.2, 0.14, 0.16));             // muzzle
  const nose = mesh(sphere, glossy, 0, -0.045, 0.375, 0.066, 0.05, 0.05);
  head.add(nose);
  head.add(mesh(lowSphere, sparkle, 0.022, -0.028, 0.418, 0.014, 0.01, 0.006));
  // Mouth line, then the jaw that opens beneath it.
  head.add(mesh(lowSphere, mouthMat, 0, -0.15, 0.33, 0.07, 0.022, 0.03));
  const jaw = joint(head, 0, -0.16, 0.2);
  jaw.add(mesh(sphere, cream, 0, -0.02, 0.06, 0.13, 0.06, 0.12));
  const tongue = mesh(sphere, tongueMat, 0, -0.012, 0.12, 0.06, 0.022, 0.08);
  jaw.add(tongue);
  // Cheek blush.
  for (const side of [-1, 1]) {
    const cheek = new Mesh(geo(new CircleGeometry(0.055, 20)), blush);
    cheek.position.set(side * 0.235, -0.07, 0.19); cheek.rotation.y = side * 0.95;
    head.add(cheek);
  }
  // Big glossy eyes with two catch-lights each.
  const eyes = [-1, 1].map((side) => {
    const eye = joint(head, side * 0.13, 0.035, 0.265);
    eye.add(mesh(sphere, eyeMat, 0, 0, 0, 0.074, 0.084, 0.05));
    eye.add(mesh(lowSphere, sparkle, 0.024, 0.032, 0.042, 0.022, 0.024, 0.01));
    eye.add(mesh(lowSphere, sparkle, -0.02, -0.025, 0.046, 0.01, 0.01, 0.006));
    eye.add(mesh(lowSphere, earFur, 0, 0.11, 0.01, 0.045, 0.012, 0.012)).rotation.z = side * -0.25; // brow
    return eye;
  });
  // Floppy ears hang from the top of the head.
  const ears = [-1, 1].map((side) => {
    const ear = joint(head, side * 0.24, 0.19, -0.03);
    // Long soft flaps that hang down beside the cheeks, curving slightly forward.
    const flap = mesh(sphere, earFur, side * 0.03, -0.19, 0.03, 0.06, 0.23, 0.13);
    flap.rotation.set(0.12, 0, side * 0.08);
    ear.add(flap);
    ear.rotation.z = side * 0.2;
    return ear;
  });

  // ── sockets for contact points
  const socket = (parentObject: Object3D, x: number, y: number, z: number): Object3D => joint(parentObject, x, y, z);
  const sockets = {
    nose: socket(head, 0, -0.05, 0.43), mouth: socket(jaw, 0, -0.01, 0.17),
    pawL: socket(legs.fl.paw, 0, -0.05, 0.08), pawR: socket(legs.fr.paw, 0, -0.05, 0.08),
  };

  // ── soft contact shadow on the felt
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
  const shadow = new Mesh(geo(new PlaneGeometry(1.25, 1.25)), shadowMat);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.renderOrder = -1;
  root.add(shadow);

  root.traverse((object) => { object.matrixAutoUpdate = true; });
  return {
    root, body, neck, head, jaw, tongue, eyes, ears, tail, legs, shadow, sockets,
    dispose() {
      root.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      shadowTexture.dispose();
    },
  };
}
