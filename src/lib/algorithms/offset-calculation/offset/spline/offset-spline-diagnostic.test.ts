import { describe, expect, it } from 'vitest';
import { offsetSpline } from './spline';
import { OffsetDirection } from '../types';
import type { Spline } from '$lib/geometry/spline';

describe('Spline Offset Diagnostic Tests', () => {
    // Test individual verb-nurbs operations to find the hanging one

    const simpleSpline: Spline = {
        controlPoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 200, y: 100 },
        ],
        degree: 2,
        knots: [0, 0, 0, 1, 1, 1],
        weights: [1, 1, 1],
        fitPoints: [],
        closed: false,
    };

    const problematicSpline: Spline = {
        controlPoints: [
            { x: 50, y: 250 },
            { x: 150, y: 300 },
            { x: 200, y: 200 },
            { x: 250, y: 100 },
            { x: 300, y: 50 },
            { x: 400, y: 100 },
        ],
        degree: 3,
        knots: [0, 0, 0, 0, 0.33, 0.66, 1, 1, 1, 1],
        weights: [1, 1, 1, 1, 1, 1],
        fitPoints: [],
        closed: false,
    };

    it('should handle simple spline without hanging', { timeout: 5000 }, () => {
        const result = offsetSpline(
            simpleSpline,
            10,
            OffsetDirection.OUTSET,
            1.0,
            1
        );
        expect(result.success).toBe(true);
    });

    it(
        'should identify problematic spline that hangs',
        { timeout: 10000 },
        () => {
            const result = offsetSpline(
                problematicSpline,
                10,
                OffsetDirection.OUTSET,
                1.0,
                1
            );
            expect(result.success).toBe(true);
        }
    );

    it('should handle reduced complexity spline', { timeout: 5000 }, () => {
        // Create a much simpler spline that should definitely work
        const reducedSpline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            degree: 2,
            knots: [0, 0, 0, 1, 1, 1], // 3 control points + 2 degree + 1 = 6 knots
            weights: [1, 1, 1],
            fitPoints: [],
            closed: false,
        };

        const result = offsetSpline(
            reducedSpline,
            1,
            OffsetDirection.OUTSET,
            0.1,
            3
        ); // Use more conservative parameters
        expect(result.success).toBe(true);
    });

    it(
        'should handle spline with fewer control points',
        { timeout: 5000 },
        () => {
            const fewerPointsSpline: Spline = {
                controlPoints: [
                    { x: 50, y: 250 },
                    { x: 150, y: 300 },
                    { x: 250, y: 100 },
                ],
                degree: 2,
                knots: [0, 0, 0, 1, 1, 1],
                weights: [1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = offsetSpline(
                fewerPointsSpline,
                10,
                OffsetDirection.OUTSET,
                1.0,
                1
            );
            expect(result.success).toBe(true);
        }
    );
});
