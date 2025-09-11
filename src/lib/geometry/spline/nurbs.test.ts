import { describe, expect, it } from 'vitest';
import { evaluateNURBS, sampleNURBS } from '$lib/geometry/spline';
import type { Spline } from '$lib/geometry/spline';

describe('NURBS Evaluation', () => {
    it('should evaluate a simple linear spline', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [],
            weights: [],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startPoint = evaluateNURBS(0, spline);
        const endPoint = evaluateNURBS(1, spline);
        const midPoint = evaluateNURBS(0.5, spline);

        expect(startPoint.x).toBeCloseTo(0, 5);
        expect(startPoint.y).toBeCloseTo(0, 5);
        expect(endPoint.x).toBeCloseTo(10, 5);
        expect(endPoint.y).toBeCloseTo(10, 5);
        expect(midPoint.x).toBeCloseTo(5, 5);
        expect(midPoint.y).toBeCloseTo(5, 5);
    });

    it('should evaluate a quadratic spline', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [],
            weights: [],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startPoint = evaluateNURBS(0, spline);
        const endPoint = evaluateNURBS(1, spline);
        const midPoint = evaluateNURBS(0.5, spline);

        expect(startPoint.x).toBeCloseTo(0, 5);
        expect(startPoint.y).toBeCloseTo(0, 5);
        expect(endPoint.x).toBeCloseTo(10, 5);
        expect(endPoint.y).toBeCloseTo(0, 5);

        // Mid point should be influenced by the middle control point
        expect(midPoint.x).toBeCloseTo(5, 5);
        expect(midPoint.y).toBeGreaterThan(0); // Should be pulled up by middle control point
    });

    it('should sample multiple points along a spline', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [],
            weights: [],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const samples = sampleNURBS(spline, 10);

        expect(samples).toHaveLength(11); // 0 to 10 inclusive
        expect(samples[0].x).toBeCloseTo(0, 5);
        expect(samples[0].y).toBeCloseTo(0, 5);
        expect(samples[10].x).toBeCloseTo(10, 5);
        expect(samples[10].y).toBeCloseTo(0, 5);
    });

    it('should handle splines with custom knot vectors', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1], // Clamped knot vector for degree 2
            weights: [],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startPoint = evaluateNURBS(0, spline);
        const endPoint = evaluateNURBS(1, spline);

        expect(startPoint.x).toBeCloseTo(0, 5);
        expect(startPoint.y).toBeCloseTo(0, 5);
        expect(endPoint.x).toBeCloseTo(10, 5);
        expect(endPoint.y).toBeCloseTo(0, 5);
    });

    it('should handle rational splines with weights', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [],
            weights: [1, 2, 1], // Give middle control point more influence
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const midPoint = evaluateNURBS(0.5, spline);

        // With higher weight on middle control point, curve should be pulled closer to it
        expect(midPoint.x).toBeCloseTo(5, 5);
        expect(midPoint.y).toBeGreaterThan(2.5); // Should be higher than unweighted case
    });

    it('should prefer fit points when available', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [],
            weights: [],
            degree: 1,
            fitPoints: [
                { x: 0, y: 0 },
                { x: 2, y: 4 },
                { x: 5, y: 6 },
                { x: 8, y: 8 },
                { x: 10, y: 10 },
            ],
            closed: false,
        };

        const samples = sampleNURBS(spline, 4);

        // Should return fit points when they are dense enough
        expect(samples).toHaveLength(5);
        expect(samples[0]).toEqual({ x: 0, y: 0 });
        expect(samples[2]).toEqual({ x: 5, y: 6 });
        expect(samples[4]).toEqual({ x: 10, y: 10 });
    });
});
