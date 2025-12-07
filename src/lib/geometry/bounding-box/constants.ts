/**
 * Angular measurement for 270 degrees in radians (3π/2) - bounding box calculations
 */

import type { BoundingBoxData } from './interfaces';

// eslint-disable-next-line no-magic-numbers
export const THREE_HALVES_PI = (3 * Math.PI) / 2;

export const EMPTY_BOUNDS: BoundingBoxData = {
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
};
