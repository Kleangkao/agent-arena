import {HEIGHT, WIDTH, walkable, neighbors, point, spawns, walls, crates} from '../v2/yard.js';

export const unit = 5940;
export const radius = 900;
export type Position = Readonly<{x: number; y: number}>;
type Box = {left: number; top: number; right: number; bottom: number};
export const equal = (a: Position, b: Position) => a.x === b.x && a.y === b.y;
export const gap = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const center = (cell: number): Position => {
  const {x, y} = point(cell);
  return {x: x * unit + unit / 2, y: y * unit + unit / 2};
};
export const starts = spawns.map(center);
export const cellAt = ({x, y}: Position, reverse = false) => Math.floor(y / unit) * WIDTH + Math.floor((x - Number(reverse)) / unit);
export const obstacles = [...walls, ...crates].map(cell => {
  const {x, y} = point(cell);
  return {left: x * unit, top: y * unit, right: (x + 1) * unit, bottom: (y + 1) * unit};
});
const expand = (b: Box, by: number): Box => ({left: b.left - by, right: b.right + by, top: b.top - by, bottom: b.bottom + by});
export const solid = obstacles.map(box => expand(box, radius));
const separation = expand({left: 0, right: 0, top: 0, bottom: 0}, radius * 2);

// Test each rectangle edge with integer cross-products. Contacts and exact corners count.
function intersects(a: Position, b: Position, box: Box) {
  if (Math.max(a.x, b.x) < box.left || Math.min(a.x, b.x) > box.right ||
      Math.max(a.y, b.y) < box.top || Math.min(a.y, b.y) > box.bottom) return false;
  if (a.x >= box.left && a.x <= box.right && a.y >= box.top && a.y <= box.bottom) return true;
  const [fromX, toX] = a.x <= b.x ? [a, b] : [b, a];
  const dx = toX.x - fromX.x;
  if (dx) for (const x of [box.left, box.right]) {
    if (x < fromX.x || x > toX.x) continue;
    const y = fromX.y * dx + (toX.y - fromX.y) * (x - fromX.x);
    if (y >= box.top * dx && y <= box.bottom * dx) return true;
  }
  const [fromY, toY] = a.y <= b.y ? [a, b] : [b, a];
  const dy = toY.y - fromY.y;
  if (dy) for (const y of [box.top, box.bottom]) {
    if (y < fromY.y || y > toY.y) continue;
    const x = fromY.x * dy + (toY.x - fromY.x) * (y - fromY.y);
    if (x >= box.left * dy && x <= box.right * dy) return true;
  }
  return false;
}
export const inside = ({x, y}: Position) => Number.isInteger(x) && Number.isInteger(y) &&
  x >= radius && x <= WIDTH * unit - radius && y >= radius && y <= HEIGHT * unit - radius;
export const openSegment = (a: Position, b: Position) => inside(a) && inside(b) && !solid.some(box => intersects(a, b, box));
export const clearSight = (a: Position, b: Position) => !obstacles.some(box => intersects(a, b, box));
export const agentsCollide = (a: Position, aNext: Position, b: Position, bNext: Position) =>
  intersects({x: a.x - b.x, y: a.y - b.y}, {x: aNext.x - bNext.x, y: aNext.y - bNext.y}, separation);

// Preserve a bounded L1 speed, with mirrored rounding for negative deltas.
export function toward(from: Position, to: Position, budget: number): Position {
  const distance = gap(from, to);
  if (distance <= budget) return to;
  const dx = to.x - from.x, dy = to.y - from.y;
  const x = Math.round(Math.abs(dx) * budget / distance);
  return {x: from.x + Math.sign(dx) * x, y: from.y + Math.sign(dy) * (budget - x)};
}

// The grid suggests routes around solid geometry; neither endpoints nor motion must be at centers.
export function route(from: Position, to: Position, limit: number, reverse: boolean): Position[] | undefined {
  if (!openSegment(to, to) || equal(from, to)) return;
  const origin = cellAt(from, reverse), goal = cellAt(to, reverse);
  if (!walkable(goal)) return;
  if (gap(from, to) <= limit * unit && openSegment(from, to)) return [to];
  const routes = new Map<number, number[]>([[origin, []]]);
  for (const [cell, path] of routes) {
    if (cell === goal) {
      const points = [center(origin), ...path.map(center)];
      if (!equal(points.at(-1)!, to)) points.push(to);
      while (points.length > 1 && openSegment(from, points[1])) points.shift();
      if (openSegment(from, points[0])) return points;
    }
    if (path.length === limit) continue;
    for (const next of neighbors(cell, reverse)) if (!routes.has(next)) routes.set(next, [...path, next]);
  }
}
