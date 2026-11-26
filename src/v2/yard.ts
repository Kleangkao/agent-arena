export type Cell = number;
export const WIDTH = 9;
export const HEIGHT = 7;
export const MAP_VERSION = 'dust-yard-grid-v2.0';
export const walls = [13, 22, 40, 49];
export const crates = [20, 24, 38, 42];
export const spawns = [28, 34] as const;
const obstacles = new Set([...walls, ...crates]);

export const point = (cell: Cell) => ({ x: cell % WIDTH, y: Math.floor(cell / WIDTH) });
export const mirror = (cell: Cell) => cell + WIDTH - 1 - 2 * (cell % WIDTH);
export function walkable(cell: Cell) {
  return Number.isInteger(cell) && cell >= 0 && cell < WIDTH * HEIGHT && !obstacles.has(cell);
}
export function distance(from: Cell, to: Cell) {
  const a = point(from), b = point(to);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function neighbors(cell: Cell, reverse = false) {
  const across = reverse ? 1 : -1;
  return [cell - WIDTH, cell + across, cell - across, cell + WIDTH]
    .filter(next => walkable(next) && distance(cell, next) === 1);
}

export function destinations(from: Cell, limit: number, reverse = false) {
  const paths = new Map<Cell, Cell[]>([[from, []]]);
  for (const [cell, path] of paths) {
    if (path.length === limit) continue;
    for (const next of neighbors(cell, reverse)) {
      if (!paths.has(next)) paths.set(next, [...path, next]);
    }
  }
  paths.delete(from);
  return paths;
}

// Integer grid traversal. Exact corner crossings check both touching tiles.
export function clearSight(from: Cell, to: Cell) {
  let {x, y} = point(from);
  const target = point(to);
  const width = Math.abs(target.x - x), height = Math.abs(target.y - y);
  const dx = Math.sign(target.x - x), dy = Math.sign(target.y - y);
  let ix = 0, iy = 0;
  while (ix < width || iy < height) {
    const crossX = (2 * ix + 1) * height;
    const crossY = (2 * iy + 1) * width;
    if (crossX === crossY) {
      if (!walkable(y * WIDTH + x + dx) || !walkable((y + dy) * WIDTH + x)) return false;
      x += dx; y += dy; ix++; iy++;
    } else if (crossX < crossY) {
      x += dx; ix++;
    } else {
      y += dy; iy++;
    }
    if (!walkable(y * WIDTH + x)) return false;
  }
  return true;
}
