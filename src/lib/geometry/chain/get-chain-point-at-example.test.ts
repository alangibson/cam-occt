/**
 * Example usage of getChainPointAt function
 *
 * This demonstrates how to find points along a chain at specific parameter values.
 */

import { describe, it, expect } from 'vitest';
import { getChainPointAt } from './functions';
import type { Chain } from './interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';

describe('getChainPointAt - Example Usage', () => {
    it('example: finding equally spaced points along a chain', () => {
        // Create a simple L-shaped chain
        const horizontalLine: Shape = {
            id: "horizontal",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const verticalLine: Shape = {
            id: "vertical",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 100, y: 0 },
                end: { x: 100, y: 100 },
            } as Line,
        };

        const chain: Chain = {
            id: 'L-shape',
            shapes: [horizontalLine, verticalLine],
        };

        // Get 5 equally spaced points along the chain
        const numPoints = 5;
        const points = [];

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1); // 0, 0.25, 0.5, 0.75, 1
            points.push(getChainPointAt(chain, t));
        }

        // Verify we got 5 points
        expect(points).toHaveLength(5);

        // Point 0: start of chain (0, 0)
        expect(points[0].x).toBe(0);
        expect(points[0].y).toBe(0);

        // Point 1: quarter way (50, 0) - middle of horizontal line
        expect(points[1].x).toBe(50);
        expect(points[1].y).toBe(0);

        // Point 2: halfway (100, 0) - junction between lines
        expect(points[2].x).toBe(100);
        expect(points[2].y).toBe(0);

        // Point 3: three-quarters (100, 50) - middle of vertical line
        expect(points[3].x).toBe(100);
        expect(points[3].y).toBe(50);

        // Point 4: end of chain (100, 100)
        expect(points[4].x).toBe(100);
        expect(points[4].y).toBe(100);
    });

    it('example: finding a point at a specific distance ratio', () => {
        const line: Shape = {
            id: "line",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 200, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'simple-line',
            shapes: [line],
        };

        // Find point at 75% of the chain length
        const point = getChainPointAt(chain, 0.75);

        expect(point.x).toBe(150); // 75% of 200
        expect(point.y).toBe(0);
    });

    it('example: sampling points for visualization', () => {
        // Create a rectangular chain
        const bottom: Shape = {
            id: "bottom",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 0 },
            } as Line,
        };

        const right: Shape = {
            id: "right",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 100, y: 0 },
                end: { x: 100, y: 50 },
            } as Line,
        };

        const top: Shape = {
            id: "top",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 100, y: 50 },
                end: { x: 0, y: 50 },
            } as Line,
        };

        const left: Shape = {
            id: "left",
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 50 },
                end: { x: 0, y: 0 },
            } as Line,
        };

        const chain: Chain = {
            id: 'rectangle',
            shapes: [bottom, right, top, left],
        };

        // Sample 8 points around the perimeter
        const samples = 8;
        const sampledPoints = Array.from({ length: samples }, (_, i) => {
            const t = i / samples; // 0, 1/8, 2/8, ..., 7/8
            return getChainPointAt(chain, t);
        });

        expect(sampledPoints).toHaveLength(8);

        // Total perimeter = 100 + 50 + 100 + 50 = 300
        // Each sample is at 300/8 = 37.5 units

        // First point should be at start
        expect(sampledPoints[0].x).toBe(0);
        expect(sampledPoints[0].y).toBe(0);
    });
});
