# PokerNow Customizer — Animation specification

## Shared contract

Every preset consumes a normalized visual event, measured viewport rectangles, visible card descriptors, deck origin, seat layout, theme artwork, validated parameters, and lifecycle controls. The same implementation runs in preview and live overlays. Presets never query PokerNow selectors or decide card identities.

IDs and supported events:

| ID | Name | Events |
| --- | --- | --- |
| `deal.dealer-flick` | Dealer Flick | Hole cards appeared |
| `deal.orbit` | Orbit Deal | Hole cards appeared |
| `flop.triple-spread` | Triple Spread | Flop revealed |
| `flop.triple-orbit` | Triple Orbit | Flop revealed |
| `flop.crystal-spread` | Crystal Spread | Flop revealed |
| `reveal.slam` | Slam / Impact Reveal | Turn, river |
| `reveal.fragment-assembly` | Fragment Assembly | Turn, river |
| `reveal.crystallization` | Crystallization Reveal | Turn, river |

The timings below are choreography design defaults, not additional game delays or claims that an effect can begin before a visible DOM update. Expose duration and speed; clamp effective duration to a documented finite range. Physical deals generally last 0.6–1.3 seconds, shared flourishes 1.1–2.4 seconds, reveals 0.9–1.9 seconds. A watchdog must bound even a malformed or abandoned run.

`t` means normalized local progress, clamped to `[0, 1]`. An element can have a relative start delay, but simultaneous properties are evaluated from the same clock. Interpolate translation, rotation, depth, scale, and opacity together. Use smoothstep or smootherstep envelopes at blends; matching endpoint position alone is insufficient when joining two moving curves. A group envelope and destination blend should preserve a moving formation until peel-away.

## Geometry and artwork

- Targets are exact measured card rectangles in viewport coordinates. A preview adapter measures its own slots using the same convention.
- Deck origin is a visible measured deck when available, otherwise a documented table-relative presentation origin. It is never an invented source of authoritative deal timing.
- All dimensions and motion radii scale from card size and measured table geometry.
- An overlay uses perspective, 3D transforms, controlled z ordering, and separate front/back card faces. Face visibility follows orientation and the available descriptor; an unknown identity cannot become a face.
- Ranks and suits come from legitimate visible identity or studio sample data. Physical fragments each clip the same complete artwork at the correct source coordinates. No full card is visible behind an incomplete assembly.
- Final state: progress 1 yields canonical target position, zero rotation/depth, unit scale, full correct face or back, and no transient fragments. Native visuals are restored and temporary nodes removed.

## Shared parameters and motion primitives

Every preset exposes bounded duration, speed, intensity, and reduced motion. V1 registry schemas define numeric controls, defaults, steps, and bounds; the studio renders those schemas. Enablement and reduced motion are workspace settings; richer enum/object schema controls are reserved for future authoring.

Reusable primitives include cubic Bézier position and tangent, interpolation, smooth envelopes, easing, damped settle, card flip, shared stack/fan, formation/orbit, per-item delay, synchronized completion, polygon clipping, semantic component placement, pulse, shockwave, and transient shake. A timeline supports parallel tracks, sequence offsets, overlaps, and progress sampling. These primitives cannot assume a specific event or number of seats.

Use slight overshoot only where a final damped settle makes physical sense. Rotations remain modest except the necessary half-turn for showing a face. No default 360-degree card spins. Per-frame effects write transforms/opacity/filter variables without repeated layout measurement.

## 1. Dealer Flick

**Purpose:** a fast tactile deal with a visible deck-to-seat connection.

**Default choreography:** distribute in seat order for round one, then seat order for round two. The order is a visual ordering derived from seat geometry; it must not imply knowledge of authoritative dealing order. Each flight occupies roughly 420–620 ms with approximately 55–100 ms relative stagger, fitted to a bounded group duration.

1. `t=0–0.15`: leave the shared origin and rise modestly in Z; retain immediate directional motion.
2. `t=0.08–0.78`: follow a cubic Bézier arc toward the destination. Use tangent-aware Z rotation, modest X/Y tilt, and a rounded depth envelope.
3. `t=0.70–1`: decelerate along the same trajectory, smoothly remove tilt, and add a tiny damped settle without pausing midflight.

The lift, flick, arc, and settle overlap. Do not use a separate move/rotate/move sequence. Hold unknown cards face-down throughout. Hero faces may flip only when already supplied by the adapter; an unknown hero descriptor still uses the back.

**Parameters:** duration, round stagger, flight curvature, lift/depth, rotation intensity, settle amount. Bound total stagger for larger tables.

**Checks:** two rounds at 2/6/9 players; shared origin; nonzero displacement during flight; unknown opponents remain backs; geometry and lifecycle exact at finish/cancel.

## 2. Orbit Deal

**Purpose:** one coordinated formation with continuous launch, shared motion, and two distribution waves.

**Default choreography:** approximately 1.7–2.3 seconds. Let the formation have a moving common center and a shared phase `θ(t)`; per-card offsets represent positions within that formation, not independent random orbits. Depth derives from phase and a small deterministic card-index offset.

1. `t=0–0.25`: launch from the deck into a curved table-relative formation, blending the shared trajectory into each card's path.
2. `t=0.15–0.62`: advance the formation through a partial revolution. Cards differ in depth/orientation and preserve related spacing.
3. `t≈0.40–0.90`: peel round-one cards into destination Béziers while round-two cards continue moving in the formation; round two peels shortly afterward.
4. `t=0.82–1`: settle, preserving the apparent two-wave dealing order.

Peel paths use the formation's position and tangent at departure. Use a smooth blend or a tangent-matched control point so the orbit never stops before the seat flight. Support arbitrary measured seat layouts; cap the formation inside the table's presentation region. No random spins, several complete revolutions, or motion through interactive controls is required.

**Parameters:** radius, formation duration fraction, card spacing, wave stagger, depth variation, rotation intensity. Radius is card/table relative.

**Checks:** formation center/phase shared by all cards; distinct depths; continuous peel; 2/6/9 players; exact targets; unknown identities never render a face.

## 3. Triple Spread

**Purpose:** a physical three-card flourish that spreads and flips in one movement.

**Default choreography:** approximately 0.95–1.35 seconds. Three cards begin as a compact offset stack with a shared translating center.

1. `t=0–0.28`: stack travels toward the board with elevation and a restrained bank.
2. `t=0.18–0.78`: fan positions expand continuously from the stack to the left, middle, and right destinations while group movement continues.
3. `t=0.26–0.84`: rotate each face around Y with a slight ripple of roughly 35–70 ms. Flip and spread overlap substantially.
4. `t=0.80–1`: remove the fan rotation and depth; settle together precisely into the three native slots.

Use actual target spacing rather than assuming three equally sized hardcoded slots. The middle card remains relatively central. A card's face may be displayed only because the flop event already supplies that visible identity.

**Parameters:** spread distance/width, flip ripple, lift, bank/rotation intensity, settle.

**Checks:** all three share a group path; flipping begins before spread completes; stagger remains subtle; three precise final rectangles; no Chain Reaction behavior.

## 4. Triple Orbit

**Purpose:** an elegant short three-card orbit with convincing front/back depth crossing.

**Default choreography:** approximately 1.25–1.75 seconds. Use one board-centered formation phase with approximately 120-degree offsets. The formation can be elliptical and tilt in perspective. Its phase advances through a short arc, typically less than a full revolution.

1. `t=0–0.22`: cards approach a shared center from small different offsets/depths.
2. `t=0.14–0.64`: a coordinated orbit moves each card in front of and behind neighbors. Update layer ordering from computed depth.
3. `t=0.28–0.72`: faces flip during the strongest group motion.
4. `t=0.52–0.94`: dissolve the formation through tangent-aware departure curves toward the corresponding left/middle/right slots.
5. `t=0.88–1`: finish nearly simultaneously with rotation, scale, and depth resolved.

**Parameters:** radius, orbit arc, orbit tilt, depth, flip timing, departure overlap. Cap excessive rotation and duration.

**Checks:** actual depth ordering changes; orbit is shared and brief; no stop at departure; flip overlaps motion; no slot swapping.

## 5. Crystal Spread

**Purpose:** one shared crystallization field constructing three cards as they separate.

**Default choreography:** approximately 1.7–2.4 seconds. Construct 20–40 clipped polygons per card, subject to a strict total budget. Cards begin closer together than their targets. The entire field shares a center, phase, seed arrangement, and completion envelope.

1. `t=0–0.22`: outer-edge/background fragments seed a single board construction field from different directions and depths. There is no complete card behind them.
2. `t=0.14–0.70`: incomplete card silhouettes become visible near one another. Their parent construction transforms drift left/center/right while incoming fragments aim at the moving parents.
3. `t=0.42–0.82`: identity-bearing fragments increasingly arrive. Rank/suit/pip/illustration regions become recognizable progressively.
4. `t=0.72–0.97`: arrival density increases sharply; the last 20–30% of time supplies a dense burst of arrivals.
5. `t=0.95–1`: all three lock within a short shared window and receive one subtle group completion pulse.

Sort early fragments using border/edge proximity and later fragments using overlap with meaningful card regions. Keep exact geometric coverage: approximately 40% assembled means approximately 40% of artwork area exists, allowing for different polygon areas. Fragment start positions can derive from a shared deterministic field so replay is reproducible. Each fragment's final clipping coordinates match its artwork source exactly.

**Parameters:** fragment count, shared spread, depth variation, assembly acceleration, outward card drift, completion pulse. The setting controls a shared composition, not three independent effects launched side by side.

**Checks:** inspect intermediate frames for genuine holes; real artwork in every fragment; edge-before-identity ordering; coordinated drift and shared field; synchronized finish; capped DOM nodes.

## 6. Slam / Impact Reveal

**Purpose:** physical force, anticipation, fast acceleration, and impact.

**Default choreography:** approximately 0.85–1.35 seconds. Local focus stays subtle and never conceals player actions or betting information.

1. `t=0–0.25`: incoming card appears elevated and slightly offset, with a brief continuous anticipation motion and shadow expansion.
2. `t=0.12–0.62`: perform the face flip as translation and depth continue.
3. `t=0.45–0.76`: accelerate toward the measured slot; shadow contracts rapidly with depth.
4. `t≈0.76`: short compression, shockwave, or restrained local board reaction communicates impact.
5. `t=0.76–1`: damp the squash/shake and restore canonical presentation.

Animate overlay reactions or explicitly owned temporary styles; do not move native betting controls. Avoid a whole-page shake. Neighbor reactions must restore original transforms exactly. River may default to approximately 1.15× turn intensity, independently configurable and clamped.

**Parameters:** impact force, anticipation fraction, shake strength, shockwave intensity, elevation/travel, squash, optional stronger river.

**Checks:** strong acceleration near impact; flip and descent overlap; force changes visible response; canonical slot remains exact; cleanup restores any neighboring styles.

## 7. Fragment Assembly

**Purpose:** identity and suspense through semantic pieces, distinct from physical polygon construction.

**Default choreography:** approximately 1.3–1.9 seconds. Render separate real card components: background/border, corner rank/suit groups, central pips, and a coherent illustration for face cards. Keep a face-card illustration in one or a few meaningful groups; do not turn it into dozens of tiny pieces.

1. `t=0–0.28`: suit and rank components materialize around the target area with related trajectories. The visible values must match the already revealed descriptor.
2. `t=0.15–0.62`: components move around a common field while the identity becomes progressively readable. The body remains partial or absent.
3. `t=0.42–0.91`: each component travels toward its exact source-art placement; rank, suit/pips, artwork, and background use distinct overlapping timing.
4. `t=0.68–0.96`: card body and border complete behind arriving identity components.
5. `t=0.93–1`: components lock and a restrained finishing accent resolves.

Component generation shares the same source layout as the complete rendered card. Avoid duplicated rank/suit symbols remaining behind a complete card. This animation can reveal rank/suit earlier than the locally animated full body only because PokerNow already revealed the identity before the event began.

**Parameters:** semantic spread, orbit arc, component stagger, body delay, depth variation, finishing accent. Number-card pip counts remain meaningful.

**Checks:** A, 2, 8, 10, J, Q, K across suits; semantic source placement equals final artwork; face art stays coherent; body/component timing distinct; no arbitrary geometric shattering.

## 8. Crystallization Reveal

**Purpose:** physical card materialization from actual polygonal artwork fragments.

**Default choreography:** approximately 1.35–1.95 seconds. Partition the complete artwork into roughly 20–40 non-overlapping triangles or convex polygons covering the card. Use larger sections rather than micro-particles.

1. `t=0–0.20`: seed a few edge/background pieces from a shared construction field.
2. `t=0.15–0.62`: silhouettes and borders emerge; fragments enter from different depths while card identity remains incomplete.
3. `t=0.40–0.80`: increasingly recognizable interior pieces lock into their exact artwork coordinates.
4. `t=0.72–0.97`: accelerate arrival density and reduce unassembled area quickly.
5. `t=0.96–1`: assemble the final pieces and apply a subtle crystalline pulse.

During flight each fragment holds the correct clipped portion of the final artwork, transformed as an independent object. A fully opaque complete card cannot sit under the fragment layer. A one-frame seam-free handoff at completion is acceptable after all fragments arrive.

**Parameters:** fragment count, spread, assembly acceleration, depth variation, rotation intensity, completion pulse.

**Checks:** 20/30/40 fragments; no holes in final coverage or overlap seams from incorrect source coordinates; genuine partial artwork at intermediate progress; late acceleration; clear distinction from semantic assembly.

## Lifecycle, concurrency, and accessibility

Preparation must build usable overlay artwork before any native card is concealed. If preparation fails, show the native card immediately and end. Conceal only the measured card nodes the run owns, never a container containing controls. Track original inline styles/attributes and restore them even after native nodes detach.

`finish()` samples the terminal state, restores native presentation, removes overlay objects, and resolves exactly once. `cancel()` restores immediately without replaying an impact. Both are idempotent. Exceptions, watchdog timeout, hidden tab, page navigation, changed geometry, theme changes, reset, and extension disable all use the same cleanup path.

Disjoint destinations may animate concurrently within a small budget. A reset or geometry change cancels conflicting runs. Newer street events should never cause an old reveal to conceal a new native card. Late events may resolve instantly rather than replay stale presentation.

Reduced motion replaces trajectories with immediate or very short appearance/restoration and no spatial flourishes, fragment storm, shake, or flash. Keep artwork correct and final geometry identical. The reduced-motion implementation is a registry-level behavior shared by preview and live runs.

## Validation evidence

For every preset record preview results, parameter extremes, cancellation at early/middle/late progress, reduced motion, player/card counts, and final cleanup. Capture representative intermediate frames for physical versus semantic fragment effects and group choreography. Separately record actual PokerNow sessions and supported selectors in `POKERNOW_INTEGRATION.md` and the compatibility report. This specification defines intended behavior, not proof of completed implementation.

## Implemented runtime defaults

| Preset | Group duration at 1× | Reduced motion |
| --- | --- | --- |
| Dealer Flick | 1,200 ms | Immediate canonical state |
| Orbit Deal | 2,150 ms | Immediate canonical state |
| Triple Spread | 1,250 ms | Immediate canonical state |
| Triple Orbit | 1,650 ms | Immediate canonical state |
| Crystal Spread | 2,300 ms | Immediate canonical state |
| Slam / Impact Reveal | 1,200 ms | Immediate canonical state |
| Fragment Assembly | 1,750 ms | Immediate canonical state |
| Crystallization Reveal | 1,850 ms | Immediate canonical state |

Duration and preset/workspace speed combine before a 120–10,000 ms effective-duration clamp. An independent 12,000 ms watchdog restores all sources even while paused or preparing. At most three disjoint runs coexist; at most 24 cards, 512 timeline tracks, and 600 temporary descendants are allowed per run. Physical fragment counts are 20–40 per card, with at most 120 pieces for the shared flop. These are enforced runtime budgets, not an FPS measurement.
