import type { CardIdentity } from '../../types';

export interface Vertex { x: number; y: number }
export interface ArtworkFragment { id: string; polygon: Vertex[]; center: Vertex; area: number; edge: boolean }

export function polygonArea(polygon: Vertex[]): number {
  return Math.abs(polygon.reduce((area, vertex, index) => {
    const next = polygon[(index + 1) % polygon.length]!;
    return area + vertex.x * next.y - next.x * vertex.y;
  }, 0)) / 2;
}

export function polygonCenter(polygon: Vertex[]): Vertex {
  return { x: polygon.reduce((sum, vertex) => sum + vertex.x, 0) / polygon.length,
    y: polygon.reduce((sum, vertex) => sum + vertex.y, 0) / polygon.length };
}

/** Exact nonoverlapping rectangular tessellation, each cell split on alternating diagonals.
 * Counts 20–40 are exact, including odd counts (one uncut quadrilateral).
 * Coordinates are normalized, so every clipped layer samples identical source artwork.
 */
export function partitionArtwork(requestedCount: number): ArtworkFragment[] {
  const count = Math.min(40, Math.max(20, Math.round(requestedCount)));
  const cells = Math.ceil(count / 2);
  const rows = 4;
  const rowCells = Array.from({ length: rows }, (_, row) => Math.floor(cells / rows) + (row < cells % rows ? 1 : 0));
  const result: ArtworkFragment[] = [];
  for (let row = 0; row < rows; row++) {
    const columns = rowCells[row]!;
    for (let column = 0; column < columns; column++) {
      const a = { x: column / columns, y: row / rows }, b = { x: (column + 1) / columns, y: row / rows };
      const c = { x: (column + 1) / columns, y: (row + 1) / rows }, d = { x: column / columns, y: (row + 1) / rows };
      const polygons = count % 2 && row === rows - 1 && column === columns - 1
        ? [[a, b, c, d]] : (row + column) % 2 ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]];
      for (const polygon of polygons) result.push({ id: `piece-${result.length}`, polygon,
        center: polygonCenter(polygon), area: polygonArea(polygon), edge: polygon.some(vertex => vertex.x === 0 || vertex.x === 1 || vertex.y === 0 || vertex.y === 1) });
    }
  }
  return result;
}

export const polygonClip = (polygon: Vertex[]): string => `polygon(${polygon.map(vertex => `${vertex.x * 100}% ${vertex.y * 100}%`).join(',')})`;

export interface SemanticRegion {
  id: string;
  kind: 'rank' | 'suit' | 'artwork' | 'body';
  polygons: Vertex[][];
  center: Vertex;
}

const rectangle = (x: number, y: number, width: number, height: number): Vertex[] => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
];

/** Semantic clipping follows the renderer's 100×140 design coordinates.
 * Corners and center never overlap. Face illustrations stay in one coherent piece.
 * The body is represented by the remaining cells, all moving as one visual object.
 */
export function semanticRegions(identity: CardIdentity | undefined): SemanticRegion[] {
  if (!identity) return [{ id: 'back', kind: 'body', polygons: [rectangle(0, 0, 1, 1)], center: { x: 0.5, y: 0.5 } }];
  const regions: SemanticRegion[] = [
    { id: 'rank-top', kind: 'rank', polygons: [rectangle(0, 0, 0.24, 0.15)], center: { x: 0.12, y: 0.075 } },
    { id: 'suit-top', kind: 'suit', polygons: [rectangle(0, 0.15, 0.24, 0.15)], center: { x: 0.12, y: 0.225 } },
    { id: 'rank-bottom', kind: 'rank', polygons: [rectangle(0.76, 0.85, 0.24, 0.15)], center: { x: 0.88, y: 0.925 } },
    { id: 'suit-bottom', kind: 'suit', polygons: [rectangle(0.76, 0.70, 0.24, 0.15)], center: { x: 0.88, y: 0.775 } },
  ];
  // These strips tile the rest of the artwork exactly, without revealing a full card underneath.
  const body = [rectangle(0.24, 0, 0.52, 0.23), rectangle(0.76, 0, 0.24, 0.70),
    rectangle(0, 0.30, 0.24, 0.70), rectangle(0.24, 0.77, 0.52, 0.23)];
  const isFace = ['J', 'Q', 'K'].includes(identity.rank);
  if (isFace || identity.rank === 'A') {
    regions.push({ id: 'central-artwork', kind: 'artwork', polygons: [rectangle(0.24, 0.23, 0.52, 0.54)], center: { x: 0.5, y: 0.5 } });
  } else {
    // Separate meaningful pip rows rather than arbitrary physical shards.
    const rows = Math.min(4, Math.max(2, Math.ceil(Number(identity.rank) / 2)));
    for (let row = 0; row < rows; row++) regions.push({ id: `pip-group-${row}`, kind: 'suit',
      polygons: [rectangle(0.24, 0.23 + row * 0.54 / rows, 0.52, 0.54 / rows)],
      center: { x: 0.5, y: 0.23 + (row + 0.5) * 0.54 / rows } });
  }
  regions.push({ id: 'card-body', kind: 'body', polygons: body, center: { x: 0.5, y: 0.5 } });
  return regions;
}
