import { describe, expect, it } from 'vitest';
import type { Spline } from './interfaces';
import {
    tessellateSpline,
    validateKnotVector,
    convertToClampedKnotVector,
    generateUniformKnotVector,
} from './functions';

describe('NURBS Knot Vector Validation and Conversion', () => {
    describe('Real DXF spline data', () => {
        it('should handle uniform knot vectors from DXF splines', () => {
            // This represents a typical DXF spline with uniform knot vector
            const dxfSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 10 },
                    { x: 10, y: 0 },
                    { x: 15, y: 10 },
                ],
                degree: 3,
                knots: [0, 0, 0, 0, 10, 10, 10, 10], // Uniform, not clamped properly
                weights: [1, 1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            // Check if this knot vector is considered valid
            const validation = validateKnotVector(
                dxfSpline.knots,
                dxfSpline.controlPoints.length,
                dxfSpline.degree
            );
            // This knot vector [0,0,0,0,10,10,10,10] has proper structure and multiplicities
            expect(validation.isValid).toBe(true);

            // Should tessellate successfully without throwing errors
            const result = tessellateSpline(dxfSpline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
        });

        it('should handle non-normalized knot vectors', () => {
            // Spline with knots not in [0,1] range
            const spline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                    { x: 20, y: 0 },
                ],
                degree: 2,
                knots: [0, 0, 0, 100, 100, 100], // Different scale
                weights: [1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(spline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
        });

        it('should handle degree-4 splines with complex knot vectors', () => {
            // Higher degree spline (cubic to quartic)
            const complexSpline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 2, y: 8 },
                    { x: 8, y: 12 },
                    { x: 12, y: 8 },
                    { x: 20, y: 0 },
                ],
                degree: 4,
                knots: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1], // Should be clamped properly
                weights: [1, 1, 1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(complexSpline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
        });
    });

    describe('Knot vector conversion utilities', () => {
        it('should convert uniform to clamped knot vector', () => {
            const uniformKnots = [0, 0, 0, 0, 10, 10, 10, 10];
            const degree = 3;
            const numControlPoints = 4;

            const clampedKnots = convertToClampedKnotVector(
                uniformKnots,
                degree,
                numControlPoints
            );

            console.log('Original knots:', uniformKnots);
            console.log('Converted knots:', clampedKnots);

            // The function generates a new uniform knot vector in [0,1] range
            // For 4 control points, degree 3: [0,0,0,0,1,1,1,1] (no interior knots)
            expect(clampedKnots.length).toBe(numControlPoints + degree + 1);

            // Check start clamping
            for (let i = 0; i <= degree; i++) {
                expect(clampedKnots[i]).toBe(0);
            }

            // Check end clamping
            for (
                let i = clampedKnots.length - degree - 1;
                i < clampedKnots.length;
                i++
            ) {
                expect(clampedKnots[i]).toBe(1);
            }
        });

        it('should generate valid uniform knot vector', () => {
            const numControlPoints = 5;
            const degree = 2;

            const knots = generateUniformKnotVector(numControlPoints, degree);

            // Should be [0,0,0, 0.5, 1,1,1]
            expect(knots.length).toBe(numControlPoints + degree + 1);
            expect(knots[0]).toBe(0);
            expect(knots[knots.length - 1]).toBe(1);

            const validation = validateKnotVector(
                knots,
                numControlPoints,
                degree
            );
            expect(validation.isValid).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty knot vector gracefully', () => {
            const spline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                ],
                degree: 1,
                knots: [], // Empty knots
                weights: [1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(spline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
        });

        it('should handle invalid knot vector length', () => {
            const spline: Spline = {
                controlPoints: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                    { x: 10, y: 0 },
                ],
                degree: 2,
                knots: [0, 0, 1, 1], // Wrong length (should be 6, not 4)
                weights: [1, 1, 1],
                fitPoints: [],
                closed: false,
            };

            const result = tessellateSpline(spline);
            expect(result.success).toBe(true);
            expect(result.points.length).toBeGreaterThan(0);
        });
    });
});
