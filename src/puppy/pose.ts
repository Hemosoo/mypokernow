import type { Leg, PuppyRig } from './model';

/**
 * Everything the puppy's body can express, as numbers. The brain blends poses;
 * `applyPose` turns one into joint rotations. Angles are radians.
 */
export interface PuppyPose {
  /** Vertical offset of the whole puppy (jumps), in model units. */
  lift: number;
  /** Extra yaw on top of the travel heading (spins, glances). */
  spin: number;
  bob: number;
  /** Squash (<1) and stretch (>1) along y, volume preserved. */
  stretch: number;
  /** Body pitch: positive leans forward (nose down). */
  lean: number;
  /** Body roll, for playful wiggles. */
  roll: number;
  /** 0 standing … 1 sitting. */
  sit: number;
  /** 0 … 1 play bow: chest down, rear up. */
  bow: number;
  headYaw: number; headPitch: number; headTilt: number;
  /** Ear flop, each side (positive swings out). */
  earL: number; earR: number;
  mouth: number;
  tongue: number;
  /** 0 open … 1 closed. */
  blink: number;
  tailWag: number; tailLift: number;
  /** Gait phase in radians and its weight (0 still … 1 full stride). */
  gait: number; stride: number;
  /** Front paw raises: 0 down … 1 raised forward. Strike adds a forward reach. */
  pawL: number; pawR: number; reachL: number; reachR: number;
  /** Hind leg scratching behind the ear (right side), 0–1 and phase. */
  scratch: number; scratchPhase: number;
}

export const neutralPose = (): PuppyPose => ({
  lift: 0, spin: 0, bob: 0, stretch: 1, lean: 0, roll: 0, sit: 0, bow: 0, headYaw: 0, headPitch: 0, headTilt: 0, earL: 0, earR: 0,
  mouth: 0, tongue: 0, blink: 0, tailWag: 0, tailLift: 0, gait: 0, stride: 0, pawL: 0, pawR: 0, reachL: 0, reachR: 0, scratch: 0, scratchPhase: 0,
});

const BODY_Y = 0.44;

function setLeg(leg: Leg, hip: number, knee: number, paw = 0): void {
  leg.hip.rotation.x = hip;
  leg.knee.rotation.x = knee;
  leg.paw.rotation.x = paw;
}

export function applyPose(rig: PuppyRig, pose: PuppyPose): void {
  const { body, neck, head, jaw, tongue, eyes, ears, tail, legs } = rig;
  const sit = pose.sit, bow = pose.bow;

  // Body: sitting pitches the chest up and drops the rump; a bow does the reverse.
  const bob = pose.bob * (1 - sit * 0.6);
  body.position.y = BODY_Y + bob - sit * 0.1 - bow * 0.06 + pose.lift;
  body.position.z = -sit * 0.07;
  body.rotation.x = pose.lean - sit * 0.55 + bow * 0.38;
  body.rotation.z = pose.roll;
  const s = Math.max(0.6, Math.min(1.4, pose.stretch));
  body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));

  // Head stays level while the body pitches, then adds its own look.
  neck.rotation.x = -body.rotation.x * 0.75 + pose.headPitch;
  neck.rotation.y = pose.headYaw * 0.45;
  head.rotation.y = pose.headYaw * 0.55;
  head.rotation.z = pose.headTilt;
  jaw.rotation.x = pose.mouth * 0.5;
  tongue.visible = pose.mouth > 0.08 || pose.tongue > 0.05;
  tongue.scale.z = 0.08 * (1 + pose.tongue * 0.8);
  tongue.position.z = 0.12 + pose.tongue * 0.05;
  const lid = 1 - Math.max(0, Math.min(1, pose.blink)) * 0.88;
  for (const eye of eyes) eye.scale.y = lid;
  ears[0]!.rotation.z = -0.2 - pose.earL;
  ears[1]!.rotation.z = 0.2 + pose.earR;
  ears[0]!.rotation.x = pose.earL * -0.35;
  ears[1]!.rotation.x = pose.earR * -0.35;

  // Tail: a wave travelling to the tip, lifting with happiness.
  tail.forEach((segment, index) => {
    const t = index / (tail.length - 1);
    segment.rotation.y = pose.tailWag * (0.55 + t * 0.6) * Math.cos(index * 0.5);
    segment.rotation.x = -(0.55 + pose.tailLift * 0.35) * (index === 0 ? 1 : 0.32) + sit * (index === 0 ? 0.8 : 0);
  });

  // Legs: a trot moves diagonal pairs together.
  const swing = (phase: number) => Math.sin(phase) * 0.55 * pose.stride;
  const fold = (phase: number) => Math.max(0, Math.cos(phase)) * 0.75 * pose.stride;
  const g = pose.gait;
  const upright = -body.rotation.x; // keep standing legs vertical despite body pitch
  // Front legs, with paw raises and reaches.
  const front = (leg: Leg, phase: number, raise: number, reach: number): void => {
    const hip = upright * (1 - sit * 0.4) + swing(phase) - raise * (1.15 + reach * 0.45);
    const knee = fold(phase) * 0.6 + raise * (1.25 - reach * 1.1);
    setLeg(leg, hip, knee, -raise * 0.6 + reach * 0.4);
  };
  front(legs.fl, g, pose.pawL, pose.reachL);
  front(legs.fr, g + Math.PI, pose.pawR, pose.reachR);
  // Hind legs fold under when sitting; one can scratch.
  const hind = (leg: Leg, phase: number, scratching: number): void => {
    const sitHip = -1.15 * sit, sitKnee = 1.75 * sit;
    const scratchHip = scratching * (-1.6 + Math.sin(pose.scratchPhase) * 0.25), scratchKnee = scratching * (1.2 + Math.cos(pose.scratchPhase) * 0.2);
    const hip = (upright + swing(phase)) * (1 - sit) + sitHip * (1 - scratching) + scratchHip - bow * 0.35;
    const knee = -fold(phase) * 0.9 * (1 - sit) + sitKnee * (1 - scratching) + scratchKnee;
    setLeg(leg, hip, knee, -knee * 0.5);
  };
  hind(legs.bl, g + Math.PI, 0);
  hind(legs.br, g, pose.scratch);

  // Shadow tightens and darkens as the puppy nears the felt.
  const height = Math.max(0, pose.lift);
  rig.shadow.scale.setScalar(1 - Math.min(0.45, height * 0.8));
  (rig.shadow.material as { opacity: number }).opacity = 1 - Math.min(0.6, height * 1.4);
}
