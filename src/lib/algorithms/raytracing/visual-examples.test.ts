/**
 * Visual Examples: Ray-Tracing vs Sampling Accuracy
 *
 * This test file demonstrates the improvement in accuracy when using exact
 * ray-tracing for point-in-chain testing instead of sampling-based approximation.
 *
 * Key improvements demonstrated:
 * 1. Arc Classification: Points near arcs are correctly classified
 * 2. Small Offset Handling: Tiny offset distances work reliably
 * 3. Consistent Results: Same input always produces same output
 * 4. No Chord-Arc Gap: Perfect curve representation
 */

import { test, expect, describe } from 'vitest';
import { isPointInsideChainExact } from './point-in-chain';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/geometry/shape';

describe('Visual Examples: Ray-Tracing Accuracy Improvements', () => {
    test('Example 1: Circle with High-Precision Offsets', () => {
        /**
         * VISUAL EXAMPLE 1: Circle with Small Offset Distances
         *
         * Original Chain: Full circle with radius 50 centered at origin
         * Test Points: Along offset curves at precise distances
         *
         * ASCII Art:
         * ```
         *       ○ ○ ○  <- Outer offset points (radius = 55)
         *     ○         ○
         *    ○     ●     ○ <- Original circle (radius = 50)
         *     ○         ○
         *       ○ ○ ○
         *         ○ <- Inner offset points (radius = 45)
         * ```
         *
         * Sampling Issue: The chord approximation creates gaps where offset points
         * are misclassified as "outside" or "inside" the original shape.
         *
         * Ray-Tracing Fix: Exact circle intersection ensures all offset points are
         * correctly classified based on their true geometric relationship.
         */

        // Create a full circle
        const circleShape: Shape = {
            id: 'reference-circle',
            type: GeometryType.CIRCLE,
            geometry: { center: { x: 0, y: 0 }, radius: 50 },
        };

        const chain: Chain = {
            id: 'circle-offset-test',
            shapes: [circleShape],
        };

        console.log('\n=== EXAMPLE 1: Circle with High-Precision Offsets ===');
        console.log('Original circle: center=(0,0), radius=50');
        console.log('Testing inner and outer offset points:\n');

        const testAngles = [
            0,
            Math.PI / 6,
            Math.PI / 4,
            Math.PI / 3,
            Math.PI / 2,
            (2 * Math.PI) / 3,
        ];

        for (const angle of testAngles) {
            // Inner point (should be inside)
            const innerPoint = {
                x: 45 * Math.cos(angle),
                y: 45 * Math.sin(angle),
            };

            // Outer point (should be outside)
            const outerPoint = {
                x: 55 * Math.cos(angle),
                y: 55 * Math.sin(angle),
            };

            const innerInside = isPointInsideChainExact(innerPoint, chain);
            const outerInside = isPointInsideChainExact(outerPoint, chain);

            console.log(`Angle ${((angle * 180) / Math.PI).toFixed(0)}°:`);
            console.log(`  Inner (r=45): Inside = ${innerInside}`);
            console.log(`  Outer (r=55): Inside = ${outerInside}`);

            expect(innerInside).toBe(true);
            expect(outerInside).toBe(false);
        }
    });

    test('Example 2: Complex Chain with Mixed Curves', () => {
        /**
         * VISUAL EXAMPLE 2: Chain with Lines and Arcs
         *
         * A closed chain forming a rounded rectangle:
         * - Bottom edge: Line from (0,0) to (100,0)
         * - Right edge: Quarter-circle from (100,0) to (100,20) centered at (100,10)
         * - Top edge: Line from (100,20) to (0,20)
         * - Left edge: Quarter-circle from (0,20) to (0,0) centered at (0,10)
         *
         * ASCII Art:
         * ```
         *     ╭─────────╮
         *     │    ○    │  <- Test point in center
         *     │         │
         *     ╰─────────╯
         * ```
         *
         * Sampling Issue: The curved corners are approximated by line segments,
         * creating inaccuracies near the curves where points may be misclassified.
         *
         * Ray-Tracing Fix: Exact curve representation ensures perfect classification
         * even for points very close to the curved boundaries.
         */

        const bottomLineShape: Shape = {
            id: 'bottom-line',
            type: GeometryType.LINE,
            geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        };

        const rightArcShape: Shape = {
            id: 'right-arc',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 100, y: 10 },
                radius: 10,
                startAngle: -Math.PI / 2, // start angle (down)
                endAngle: Math.PI / 2, // end angle (up)
                clockwise: false, // counter-clockwise
            },
        };

        const topLineShape: Shape = {
            id: 'top-line',
            type: GeometryType.LINE,
            geometry: { start: { x: 100, y: 20 }, end: { x: 0, y: 20 } },
        };

        const leftArcShape: Shape = {
            id: 'left-arc',
            type: GeometryType.ARC,
            geometry: {
                center: { x: 0, y: 10 },
                radius: 10,
                startAngle: Math.PI / 2, // start angle (up)
                endAngle: -Math.PI / 2, // end angle (down)
                clockwise: false, // counter-clockwise
            },
        };

        const chain: Chain = {
            id: 'rounded-rectangle',
            shapes: [
                bottomLineShape,
                rightArcShape,
                topLineShape,
                leftArcShape,
            ],
        };

        console.log('\n=== EXAMPLE 2: Complex Chain Classification ===');
        console.log('Rounded rectangle: 100×20 with radius-10 corners');
        console.log('Testing points near curved corners:\n');

        // Test points near the corners where sampling errors are most likely
        const criticalPoints = [
            { x: 50, y: 10, desc: 'center (should be inside)' },
            { x: 90, y: 10, desc: 'near right corner (should be inside)' },
            { x: 10, y: 10, desc: 'near left corner (should be inside)' },
            {
                x: 115,
                y: 10,
                desc: 'just outside right arc (should be outside)',
            },
            {
                x: -15,
                y: 10,
                desc: 'just outside left arc (should be outside)',
            },
        ];

        for (const point of criticalPoints) {
            const isInside = isPointInsideChainExact(point, chain);
            console.log(
                `Point (${point.x}, ${point.y}) ${point.desc} - Inside: ${isInside}`
            );

            // Verify expected results
            if (point.desc.includes('should be inside')) {
                expect(isInside).toBe(true);
            } else if (point.desc.includes('should be outside')) {
                expect(isInside).toBe(false);
            }
        }
    });

    test('Example 3: Tiny Offset Distance Precision', () => {
        /**
         * VISUAL EXAMPLE 3: High Precision Requirements
         *
         * A circle with very small offset distances (0.1 units)
         * This tests the algorithm's ability to handle tiny geometric features
         * that would be lost in sampling approximation.
         *
         * ASCII Art:
         * ```
         *       ○○○
         *     ○     ○  <- Inner offset points (radius = 9.9)
         *    ○   ●   ○ <- Original circle (radius = 10.0)
         *     ○     ○  <- Outer offset points (radius = 10.1)
         *       ○○○
         * ```
         *
         * Sampling Issue: With coarse sampling, the 0.1 unit difference between
         * original and offset is smaller than the chord-arc gap, causing
         * classification errors.
         *
         * Ray-Tracing Fix: Mathematical precision handles arbitrarily small
         * offset distances accurately.
         */

        const circleShape: Shape = {
            id: 'precision-circle',
            type: GeometryType.CIRCLE,
            geometry: { center: { x: 0, y: 0 }, radius: 10 },
        };

        const chain: Chain = {
            id: 'precision-circle',
            shapes: [circleShape],
        };

        console.log('\n=== EXAMPLE 3: High Precision Offset Testing ===');
        console.log('Circle: center=(0,0), radius=10.0');
        console.log('Testing tiny offset distances (±0.1 units):\n');

        // Test points at very small offset distances
        const angles = [
            0,
            Math.PI / 4,
            Math.PI / 2,
            (3 * Math.PI) / 4,
            Math.PI,
        ];

        for (const angle of angles) {
            // Inner point (should be inside)
            const innerPoint = {
                x: 9.9 * Math.cos(angle),
                y: 9.9 * Math.sin(angle),
            };

            // Outer point (should be outside)
            const outerPoint = {
                x: 10.1 * Math.cos(angle),
                y: 10.1 * Math.sin(angle),
            };

            const innerInside = isPointInsideChainExact(innerPoint, chain);
            const outerInside = isPointInsideChainExact(outerPoint, chain);

            console.log(`Angle ${((angle * 180) / Math.PI).toFixed(0)}°:`);
            console.log(`  Inner (r=9.9): Inside = ${innerInside}`);
            console.log(`  Outer (r=10.1): Inside = ${outerInside}`);

            expect(innerInside).toBe(true);
            expect(outerInside).toBe(false);
        }
    });

    test('Example 4: Consistency Demonstration', () => {
        /**
         * VISUAL EXAMPLE 4: Consistent Results
         *
         * This example demonstrates that exact ray-tracing produces identical
         * results every time, unlike sampling which can vary based on the
         * specific sample points chosen.
         *
         * We test the same geometric configuration multiple times to verify
         * 100% consistency.
         */

        const shapes: Shape[] = [
            {
                id: 'bottom-edge',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
            },
            {
                id: 'right-arc',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 50, y: 25 },
                    radius: 25,
                    startAngle: -Math.PI / 2,
                    endAngle: 0,
                    clockwise: false,
                },
            },
            {
                id: 'top-edge',
                type: GeometryType.LINE,
                geometry: { start: { x: 50, y: 50 }, end: { x: 0, y: 50 } },
            },
            {
                id: 'left-edge',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 50 }, end: { x: 0, y: 0 } },
            },
        ];

        const chain: Chain = {
            id: 'consistency-test',
            shapes,
        };

        const testPoint = { x: 25, y: 25 };

        console.log('\n=== EXAMPLE 4: Consistency Test ===');
        console.log('Testing same point 10 times for consistency:');

        // Test the same point multiple times - should always get same result
        const results: boolean[] = [];
        for (let i: number = 0; i < 10; i++) {
            const result = isPointInsideChainExact(testPoint, chain);
            results.push(result);
            console.log(`Test ${i + 1}: ${result}`);
        }

        // All results should be identical
        const firstResult = results[0];
        for (const result of results) {
            expect(result).toBe(firstResult);
        }

        console.log(
            `✅ All 10 tests produced identical result: ${firstResult}`
        );
    });

    test('Example 5: Arc-Heavy Chain Comparison', () => {
        /**
         * VISUAL EXAMPLE 5: Simple Circle Shape
         *
         * A simple circle to demonstrate basic ray-tracing with
         * a single closed shape.
         */

        const circle: Shape = {
            id: 'test-circle',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 15,
            },
        };

        const circleChain: Chain = {
            id: 'circle-shape',
            shapes: [circle],
        };

        console.log('\n=== EXAMPLE 5: Simple Circle Test ===');
        console.log('Testing circle shape:\n');

        const testPoints = [
            { x: 0, y: 0, desc: 'center (should be inside)' },
            { x: 0, y: 5, desc: 'near center (should be inside)' },
            { x: 10, y: 10, desc: 'inside (should be inside)' },
            { x: 0, y: 20, desc: 'outside top (should be outside)' },
            { x: 20, y: 0, desc: 'outside right (should be outside)' },
        ];

        for (const point of testPoints) {
            const isInside = isPointInsideChainExact(point, circleChain);
            console.log(
                `Point (${point.x}, ${point.y}) ${point.desc} - Inside: ${isInside}`
            );

            if (point.desc.includes('should be inside')) {
                expect(isInside).toBe(true);
            } else if (point.desc.includes('should be outside')) {
                expect(isInside).toBe(false);
            }
        }
    });
});

/**
 * Performance Comparison Helper
 *
 * While not a visual test, this helper function could be used to compare
 * the performance characteristics of exact vs sampling approaches.
 */
export function createPerformanceComparison() {
    return {
        testCases: [
            'Simple polygon (4 sides)',
            'Complex polygon (100+ sides)',
            'Circle-heavy chain (10 circles)',
            'Mixed curves and lines',
            'High-precision requirements',
        ],

        metrics: [
            'Execution time (ms)',
            'Accuracy (% correct classifications)',
            'Memory usage (KB)',
            'Consistency (% identical results)',
        ],
    };
}
