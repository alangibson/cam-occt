import { describe, expect, it } from 'vitest';
import type { Spline } from './interfaces';
import { tessellateSpline } from './functions';

describe('Knot Vector Warning Fix', () => {
    it('should not generate "Invalid knot vector format!" warning with DXF-style knots', () => {
        // This reproduces the exact scenario that was causing the warning:
        // - Real DXF spline data with uniform knot vectors
        // - Non-normalized ranges (e.g., [0,0,0,0,10,10,10,10] instead of [0,0,0,0,1,1,1,1])
        const problematicSpline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
                { x: 15, y: 10 },
            ],
            degree: 3,
            knots: [0, 0, 0, 0, 10, 10, 10, 10], // This should NOT cause a warning anymore
            weights: [1, 1, 1, 1],
            fitPoints: [],
            closed: false,
        };

        // Capture console warnings during tessellation
        const originalWarn = console.warn;
        const warnings: string[] = [];
        console.warn = (...args: unknown[]) => {
            warnings.push(args.join(' '));
        };

        try {
            const result = tessellateSpline(problematicSpline);

            // Should succeed in tessellation
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);

            // Should NOT contain the specific warning about invalid knot vector format
            const hasKnotWarning = warnings.some((warning) =>
                warning.includes('Invalid knot vector format')
            );
            expect(hasKnotWarning).toBe(false);
        } finally {
            // Restore original console.warn
            console.warn = originalWarn;
        }
    });

    it('should handle various problematic knot vector formats without warnings', () => {
        const testCases = [
            {
                name: 'Non-normalized uniform knots',
                spline: {
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 10, y: 10 },
                    ],
                    degree: 1,
                    knots: [0, 0, 100, 100],
                    weights: [1, 1],
                    fitPoints: [],
                    closed: false,
                },
            },
            {
                name: 'Large scale knot values',
                spline: {
                    controlPoints: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                        { x: 10, y: 0 },
                    ],
                    degree: 2,
                    knots: [0, 0, 0, 1000, 1000, 1000],
                    weights: [1, 1, 1],
                    fitPoints: [],
                    closed: false,
                },
            },
        ];

        const originalWarn = console.warn;
        const allWarnings: string[] = [];
        console.warn = (...args: unknown[]) => {
            allWarnings.push(args.join(' '));
        };

        try {
            for (const testCase of testCases) {
                const result = tessellateSpline(testCase.spline);
                expect(result.success).toBe(true);
            }

            // Check that no knot vector format warnings were generated
            const hasKnotWarnings = allWarnings.some((warning) =>
                warning.includes('Invalid knot vector format')
            );
            expect(hasKnotWarnings).toBe(false);
        } finally {
            console.warn = originalWarn;
        }
    });
});
