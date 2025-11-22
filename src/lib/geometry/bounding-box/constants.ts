/**
 * Angular measurement for 270 degrees in radians (3π/2) - bounding box calculations
 */

import type { BoundingBox } from './interfaces';

// eslint-disable-next-line no-magic-numbers
export const THREE_HALVES_PI = (3 * Math.PI) / 2;

export const EMPTY_BOUNDS: BoundingBox = {
    min: { x: 0, y: 0 },
    max: { x: 0, y: 0 },
};
