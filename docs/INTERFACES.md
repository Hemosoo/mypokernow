# V1 implementation contracts

These contracts are fixed before implementation so the preview and site adapter feed the same renderer.

- `src/types/index.ts` exports `Street = 'deal' | 'flop' | 'turn' | 'river'`, `VisualEventType = 'TABLE_READY' | 'HAND_VISUAL_RESET' | 'HOLE_CARDS_APPEARED' | 'FLOP_REVEALED' | 'TURN_REVEALED' | 'RIVER_REVEALED'`, `Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'`, `Rank`, `CardIdentity {rank, suit}`, `Rect {x,y,width,height}`, `Point3 {x,y,z?}`.
- `VisualCard { id: string; identity?: CardIdentity; target: Rect; source?: HTMLElement; seatId?: string; round?: number }`. Absence of identity always renders the back. Source nodes are optional and may only be concealed after replacement artwork exists.
- `VisualEvent { id: string; type: VisualEventType; cards: VisualCard[]; origin: Point3; timestamp: number; seats?: Rect[] }`. All geometry is viewport CSS pixels. No future cards or networking data.
- `Theme {version: 1; id; name; createdAt; updatedAt; card: CardAppearance; table: TableAppearance; board: BoardAppearance; animations: Record<Street, AnimationAssignment> }`.
- `CardAppearance { face: 'classic'|'modern'|'midnight'|'native'; back: 'crosshatch'|'diamonds'|'solid'|'image'; backColor; backImage?: string; faceColor; redColor; blackColor; borderColor; borderRadius: number; shadow: number }`. Image strings are resolved safe local data URLs in rendering, stored `asset:` references in themes.
- `TableAppearance { feltColor; railColor; backgroundColor; backgroundImage?: string }`; `BoardAppearance { color; highlight; spacing: number; shadow: number }`.
- `AnimationAssignment {preset: string; parameters: Record<string, number>}`. Preset parameter values are finite, schema-clamped numbers.
- `Settings { enabled: boolean; reducedMotion: boolean; speed: number; activeThemeId: string }`; `Library {version: 1; settings: Settings; themes: Theme[]}`.
- `src/animation/registry/index.ts` exports `presets` (array), `getPreset(id)`, `presetsForStreet(street)`. A preset has `id`, `name`, `description`, `category`, `supportedEvents: Street[]`, `duration: number`, `parameters: ParameterSchema[]` (`key,label,min,max,step,default,unit?`), and `build(context): TimelineTrack[]`.
- `src/animation/core/coordinator.ts` exports `AnimationCoordinator`, constructor `(host: HTMLElement)`. `play(event: VisualEvent, theme: Theme, options?: {speed?: number; reducedMotion?: boolean; presetId?: string; parameters?: Record<string, number>; onProgress?: (progress:number)=>void}): AnimationHandle`. Handle has `finished: Promise<void>`, `pause()`, `resume()`, `cancel()`, `finish()`, `progress: number`. Coordinator has `cancelAll()`, `dispose()`.
- `src/rendering/cards.ts` exports `cardSvg(identity: CardIdentity | undefined, appearance: CardAppearance): string`, `cardDataUrl(identity,appearance): string`, and `createCardElement(card: VisualCard, theme: Theme): HTMLElement`.
- `src/themes/defaults.ts` exports `createDefaultTheme()`, `createDefaultLibrary()`, `builtInThemes`.
- `src/storage/library.ts` exports `loadLibrary(): Promise<Library>`, `saveLibrary(library): Promise<void>`, `subscribeLibrary(callback): () => void`.
- `src/storage/assets.ts` exports `saveAsset(file: File): Promise<string>` (`asset:` ID), `resolveThemeAssets(theme): Promise<Theme>`.
- `src/themes/transfer.ts` exports `exportTheme(theme): Promise<string>`, `importTheme(json: string): Promise<Theme>`; export embeds assets, import validates and persists assets.
- Studio owns `src/studio`, `src/preview`; adapter owns `src/adapter`, `src/content`; root owns tooling, types, storage, themes, rendering. Animation implementer owns `src/animation`.

Native artwork is preserved in compatible runtime captures; standalone previews use local classic equivalents. If native extraction is uncertain, originals stay visible. No preset can start before normal page presentation exposes the event.

All emitted timestamps use epoch milliseconds (`Date.now()`). The coordinator tolerates performance-clock timestamps from independent consumers. Completion handles resolve after safe cleanup, including failures. Content-context image reads are bridged to extension-origin IndexedDB through the service worker; uploaded assets are never read from the game page storage.
