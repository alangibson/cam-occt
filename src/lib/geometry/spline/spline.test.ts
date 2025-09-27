import { describe, expect, it } from 'vitest';
import verb from 'verb-nurbs';
import type { Spline } from './interfaces';
import {
    getSplinePointAt,
    generateUniformKnotVector,
    getSplineEndPoint,
    getSplineStartPoint,
    normalizeSplineWeights,
    reverseSpline,
    validateKnotVector,
    getSplineTangent,
} from './functions';

describe('getSplineStartPoint', () => {
    it('should return first control point for simple linear spline', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startPoint = getSplineStartPoint(spline);
        // For a linear spline, start point should be close to first control point
        expect(startPoint.x).toBeCloseTo(0, 1);
        expect(startPoint.y).toBeCloseTo(0, 1);
    });

    it('should use first fit point when available', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [
                { x: 1, y: 2 },
                { x: 8, y: 9 },
            ],
            closed: false,
        };

        const startPoint = getSplineStartPoint(spline);
        // Should return the evaluated NURBS point, not the fit point directly
        expect(typeof startPoint.x).toBe('number');
        expect(typeof startPoint.y).toBe('number');
    });
});

describe('getSplineEndPoint', () => {
    it('should return last control point for simple linear spline', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const endPoint = getSplineEndPoint(spline);
        // For a linear spline, end point should be close to last control point
        expect(endPoint.x).toBeCloseTo(10, 1);
        expect(endPoint.y).toBeCloseTo(10, 1);
    });
});

describe('reverseSpline', () => {
    it('should reverse control points and fit points', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 2, 1],
            degree: 2,
            fitPoints: [
                { x: 1, y: 1 },
                { x: 9, y: 1 },
            ],
            closed: false,
        };

        const reversed = reverseSpline(spline);

        expect(reversed.controlPoints).toEqual([
            { x: 10, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 0 },
        ]);

        expect(reversed.fitPoints).toEqual([
            { x: 9, y: 1 },
            { x: 1, y: 1 },
        ]);

        expect(reversed.weights).toEqual([1, 2, 1]);
    });
});

describe('normalizeSplineWeights', () => {
    it('should add default weights when missing', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
                { x: 10, y: 0 },
            ],
            knots: [],
            weights: [],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const normalized = normalizeSplineWeights(spline);
        expect(normalized.weights).toEqual([1, 1, 1]);
    });

    it('should keep existing weights when valid', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
            knots: [],
            weights: [1, 2],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const normalized = normalizeSplineWeights(spline);
        expect(normalized.weights).toEqual([1, 2]);
    });
});

describe('getSplinePointAt', () => {
    it('should evaluate simple linear NURBS', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startPoint = getSplinePointAt(spline, 0);
        const midPoint = getSplinePointAt(spline, 0.5);
        const endPoint = getSplinePointAt(spline, 1);

        expect(startPoint.x).toBeCloseTo(0, 1);
        expect(startPoint.y).toBeCloseTo(0, 1);

        expect(midPoint.x).toBeCloseTo(5, 1);
        expect(midPoint.y).toBeCloseTo(5, 1);

        expect(endPoint.x).toBeCloseTo(10, 1);
        expect(endPoint.y).toBeCloseTo(10, 1);
    });
});

describe('generateUniformKnotVector', () => {
    it('should generate correct knot vector for quadratic curve', () => {
        const result = generateUniformKnotVector(4, 2);
        expect(result).toEqual([0, 0, 0, 0.5, 1, 1, 1]);
        expect(result.length).toBe(4 + 2 + 1); // n + p + 1
    });

    it('should generate correct knot vector for linear curve', () => {
        const result = generateUniformKnotVector(2, 1);
        expect(result).toEqual([0, 0, 1, 1]);
        expect(result.length).toBe(2 + 1 + 1); // n + p + 1
    });
});

describe('validateKnotVector', () => {
    it('should validate correct knot vector', () => {
        const result = validateKnotVector([0, 0, 0, 1, 1, 1], 3, 2);
        expect(result.isValid).toBe(true);
    });

    it('should reject knot vector with wrong length', () => {
        const result = validateKnotVector([0, 0, 1, 1], 3, 2);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('length');
    });

    it('should reject non-decreasing knot vector', () => {
        const result = validateKnotVector([0, 0, 1, 0, 1, 1], 3, 2);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('non-decreasing');
    });
});

describe('getSplineTangent', () => {
    it('should return correct tangent for simple linear spline', () => {
        // Linear spline from (0,0) to (10,10) should have tangent (1,1) normalized
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // For a linear spline, tangent should be constant and normalized
        const expectedTangent = { x: 1 / Math.sqrt(2), y: 1 / Math.sqrt(2) };

        expect(startTangent.x).toBeCloseTo(expectedTangent.x, 6);
        expect(startTangent.y).toBeCloseTo(expectedTangent.y, 6);
        expect(endTangent.x).toBeCloseTo(expectedTangent.x, 6);
        expect(endTangent.y).toBeCloseTo(expectedTangent.y, 6);
    });

    it('should return correct tangent for horizontal linear spline', () => {
        // Horizontal spline from (0,0) to (10,0) should have tangent (1,0)
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        expect(startTangent.x).toBeCloseTo(1, 6);
        expect(startTangent.y).toBeCloseTo(0, 6);
        expect(endTangent.x).toBeCloseTo(1, 6);
        expect(endTangent.y).toBeCloseTo(0, 6);
    });

    it('should return correct tangent for vertical linear spline', () => {
        // Vertical spline from (0,0) to (0,10) should have tangent (0,1)
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 0, y: 10 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        expect(startTangent.x).toBeCloseTo(0, 6);
        expect(startTangent.y).toBeCloseTo(1, 6);
        expect(endTangent.x).toBeCloseTo(0, 6);
        expect(endTangent.y).toBeCloseTo(1, 6);
    });

    it('should return correct tangent for quadratic Bezier curve', () => {
        // Quadratic Bezier: (0,0) -> (5,10) -> (10,0)
        // Start tangent should be toward control point (5,10)
        // End tangent should be from control point (5,10) toward end
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // Start tangent should point from (0,0) toward (5,10)
        // Direction: (5,10) - (0,0) = (5,10), normalized = (0.447, 0.894)
        const startExpected = {
            x: 5 / Math.sqrt(125),
            y: 10 / Math.sqrt(125),
        };

        // End tangent should point from (5,10) toward (10,0)
        // Direction: (10,0) - (5,10) = (5,-10), normalized = (0.447, -0.894)
        const endExpected = {
            x: 5 / Math.sqrt(125),
            y: -10 / Math.sqrt(125),
        };

        expect(startTangent.x).toBeCloseTo(startExpected.x, 3);
        expect(startTangent.y).toBeCloseTo(startExpected.y, 3);
        expect(endTangent.x).toBeCloseTo(endExpected.x, 3);
        expect(endTangent.y).toBeCloseTo(endExpected.y, 3);
    });

    it('should return normalized tangent vectors', () => {
        // Any spline tangent should be a unit vector
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 3, y: 4 }, // Creates a 3-4-5 triangle, so tangent has magnitude 5
                { x: 6, y: 8 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // Check that tangent vectors are normalized (magnitude = 1)
        const startMagnitude = Math.sqrt(
            startTangent.x ** 2 + startTangent.y ** 2
        );
        const endMagnitude = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);

        expect(startMagnitude).toBeCloseTo(1, 6);
        expect(endMagnitude).toBeCloseTo(1, 6);
    });

    it('should handle circular spline approximation correctly', () => {
        // Create a spline that approximates a quarter circle
        // This should have tangents perpendicular to radius at start/end
        const radius = 5;
        const spline: Spline = {
            controlPoints: [
                { x: radius, y: 0 }, // Start at (5,0)
                { x: radius, y: radius }, // Control point at (5,5)
                { x: 0, y: radius }, // End at (0,5)
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // For a quarter circle starting at (5,0):
        // - Start tangent should be perpendicular to radius, pointing up: (0,1)
        // - End tangent should be perpendicular to radius at (0,5), pointing left: (-1,0)

        // Start tangent should be approximately (0,1)
        expect(startTangent.x).toBeCloseTo(0, 1);
        expect(startTangent.y).toBeCloseTo(1, 1);

        // End tangent should be approximately (-1,0)
        expect(endTangent.x).toBeCloseTo(-1, 1);
        expect(endTangent.y).toBeCloseTo(0, 1);
    });

    it('should maintain tangent direction consistency for reversed splines', () => {
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 5, y: 10 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, 1, 1],
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const originalStartTangent = getSplineTangent(spline, true);
        const originalEndTangent = getSplineTangent(spline, false);

        const reversedSpline = reverseSpline(spline);
        const reversedStartTangent = getSplineTangent(reversedSpline, true);
        const reversedEndTangent = getSplineTangent(reversedSpline, false);

        // Reversed spline start tangent should be opposite of original end tangent
        expect(reversedStartTangent.x).toBeCloseTo(-originalEndTangent.x, 3);
        expect(reversedStartTangent.y).toBeCloseTo(-originalEndTangent.y, 3);

        // Reversed spline end tangent should be opposite of original start tangent
        expect(reversedEndTangent.x).toBeCloseTo(-originalStartTangent.x, 3);
        expect(reversedEndTangent.y).toBeCloseTo(-originalStartTangent.y, 3);
    });

    it('should return correct tangent for circular arc spline segment', () => {
        // This test reproduces the issue seen in 2013-11-08_test.dxf
        // where splines form circular arcs but tangents are perpendicular
        // Create a spline that approximates a quarter circle arc from left to bottom
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 5 }, // Left point on circle
                { x: 0, y: 2.5 }, // Control point
                { x: 2.5, y: 0 }, // Control point
                { x: 5, y: 0 }, // Bottom point on circle
            ],
            knots: [0, 0, 0, 0, 1, 1, 1, 1],
            weights: [1, 1, 1, 1],
            degree: 3,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // At the left point (0, 5), tangent should point downward (0, -1)
        // since we're going from left to bottom in a clockwise arc
        expect(startTangent.x).toBeCloseTo(0, 2);
        expect(startTangent.y).toBeCloseTo(-1, 2);

        // At the bottom point (5, 0), tangent should point rightward (1, 0)
        expect(endTangent.x).toBeCloseTo(1, 2);
        expect(endTangent.y).toBeCloseTo(0, 2);
    });

    it('should handle tangent for circular spline with exact quarter circle', () => {
        // Create a more precise quarter circle using rational B-spline (NURBS)
        // This uses the exact NURBS representation of a quarter circle
        const w = Math.sqrt(2) / 2; // Weight for 90-degree arc
        const spline: Spline = {
            controlPoints: [
                { x: 5, y: 0 }, // Right point (start)
                { x: 5, y: 5 }, // Control point at 45 degrees
                { x: 0, y: 5 }, // Top point (end)
            ],
            knots: [0, 0, 0, 1, 1, 1],
            weights: [1, w, 1], // Middle control point has special weight
            degree: 2,
            fitPoints: [],
            closed: false,
        };

        const startTangent = getSplineTangent(spline, true);
        const endTangent = getSplineTangent(spline, false);

        // At right point (5, 0), tangent for CCW arc should point up (0, 1)
        expect(startTangent.x).toBeCloseTo(0, 2);
        expect(startTangent.y).toBeCloseTo(1, 2);

        // At top point (0, 5), tangent should point left (-1, 0)
        expect(endTangent.x).toBeCloseTo(-1, 2);
        expect(endTangent.y).toBeCloseTo(0, 2);
    });

    it('should reproduce perpendicular tangent issue from DXF circular splines', () => {
        // Create 6 spline segments that form a complete circle (60 degrees each)
        // Circle center at (100, 100) with radius 20
        const radius = 20;
        const centerX = 100;
        const centerY = 100;

        // Calculate control points for 6 cubic Bezier segments forming a circle
        // Each segment covers 60 degrees (π/3 radians)
        const circleSplines = [];

        for (let i = 0; i < 6; i++) {
            const startAngle = (i * Math.PI) / 3;
            const endAngle = ((i + 1) * Math.PI) / 3;

            // Calculate points on circle
            const startX = centerX + radius * Math.cos(startAngle);
            const startY = centerY + radius * Math.sin(startAngle);
            const endX = centerX + radius * Math.cos(endAngle);
            const endY = centerY + radius * Math.sin(endAngle);

            // For cubic Bezier approximation of circular arc, control points are at distance r * (4/3) * tan(θ/4)
            // where θ is the angle of the arc segment
            const arcAngle = Math.PI / 3; // 60 degrees
            const controlDistance = radius * (4 / 3) * Math.tan(arcAngle / 4);

            // Control points are offset perpendicular to the radius at start/end
            const ctrl1X = startX - controlDistance * Math.sin(startAngle);
            const ctrl1Y = startY + controlDistance * Math.cos(startAngle);
            const ctrl2X = endX + controlDistance * Math.sin(endAngle);
            const ctrl2Y = endY - controlDistance * Math.cos(endAngle);

            const spline: Spline = {
                controlPoints: [
                    { x: startX, y: startY },
                    { x: ctrl1X, y: ctrl1Y },
                    { x: ctrl2X, y: ctrl2Y },
                    { x: endX, y: endY },
                ],
                knots: [0, 0, 0, 0, 1, 1, 1, 1],
                weights: [1, 1, 1, 1],
                degree: 3,
                fitPoints: [],
                closed: false,
            };

            circleSplines.push(spline);
        }

        // Test all segments to show the pattern of tangent directions
        console.log('\n=== 6-Segment Circle Splines Analysis ===');
        circleSplines.forEach((spline, i) => {
            const startTangent = getSplineTangent(spline, true);
            const endTangent = getSplineTangent(spline, false);
            const expectedStartAngle = i * 60 + 90; // Tangent should be perpendicular to radius (90° ahead)
            const expectedEndAngle = (i + 1) * 60 + 90;

            console.log(`Segment ${i} (${i * 60}-${(i + 1) * 60}°):`);
            console.log(
                `  Start: (${spline.controlPoints[0].x.toFixed(2)}, ${spline.controlPoints[0].y.toFixed(2)})`
            );
            console.log(
                `  End: (${spline.controlPoints[3].x.toFixed(2)}, ${spline.controlPoints[3].y.toFixed(2)})`
            );
            console.log(
                `  Start tangent: (${startTangent.x.toFixed(3)}, ${startTangent.y.toFixed(3)})`
            );
            console.log(
                `  End tangent: (${endTangent.x.toFixed(3)}, ${endTangent.y.toFixed(3)})`
            );

            // Calculate actual angle of tangent vectors
            const actualStartAngle =
                (Math.atan2(startTangent.y, startTangent.x) * 180) / Math.PI;
            const actualEndAngle =
                (Math.atan2(endTangent.y, endTangent.x) * 180) / Math.PI;
            console.log(
                `  Actual start tangent angle: ${actualStartAngle.toFixed(1)}°`
            );
            console.log(
                `  Actual end tangent angle: ${actualEndAngle.toFixed(1)}°`
            );
            console.log(
                `  Expected start tangent angle: ${expectedStartAngle}°`
            );
            console.log(`  Expected end tangent angle: ${expectedEndAngle}°`);

            // Check if there's a consistent 90-degree error
            const startAngleError = Math.abs(
                ((actualStartAngle - expectedStartAngle + 540) % 360) - 180
            );
            const endAngleError = Math.abs(
                ((actualEndAngle - expectedEndAngle + 540) % 360) - 180
            );
            console.log(`  Start angle error: ${startAngleError.toFixed(1)}°`);
            console.log(`  End angle error: ${endAngleError.toFixed(1)}°`);
        });

        // Focus on the first segment for detailed analysis
        const firstSegment = circleSplines[0];
        const startTangent = getSplineTangent(firstSegment, true);
        const endTangent = getSplineTangent(firstSegment, false);

        // For a proper circle, tangents should be perpendicular to the radius
        // If we're seeing tangents that are 90 degrees off, there's our bug
        const startMagnitude = Math.sqrt(
            startTangent.x ** 2 + startTangent.y ** 2
        );
        const endMagnitude = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);

        expect(startMagnitude).toBeCloseTo(1, 6);
        expect(endMagnitude).toBeCloseTo(1, 6);
    });

    it('should test verb.js tangent vs derivative methods', () => {
        // Test to understand what verb.js returns
        const spline: Spline = {
            controlPoints: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ],
            knots: [0, 0, 1, 1],
            weights: [1, 1],
            degree: 1,
            fitPoints: [],
            closed: false,
        };

        // Use verb directly to test
        const curve = verb.geom.NurbsCurve.byKnotsControlPointsWeights(
            1, // degree
            [0, 0, 1, 1], // knots
            [
                [0, 0, 0],
                [10, 0, 0],
            ], // control points in 3D
            [1, 1] // weights
        );

        // Get tangent using verb's tangent method
        const tangentStart = curve.tangent(0);
        const tangentEnd = curve.tangent(1);

        // Get derivative using verb's derivatives method
        const derivativesStart = curve.derivatives(0, 1);
        const derivativesEnd = curve.derivatives(1, 1);

        console.log('Verb tangent at start:', tangentStart);
        console.log('Verb tangent at end:', tangentEnd);
        console.log('Verb derivatives at start:', derivativesStart);
        console.log('Verb derivatives at end:', derivativesEnd);

        // Verb.js returns unnormalized tangent vectors
        // For a line from (0,0) to (10,0), the derivative is (10, 0, 0)
        // This is correct - it's just not normalized
        expect(tangentStart[0]).toBe(10);
        expect(tangentStart[1]).toBe(0);
        expect(tangentEnd[0]).toBe(10);
        expect(tangentEnd[1]).toBe(0);

        // Our getSplineTangent function should normalize and rotate 90 degrees clockwise
        const ourStartTangent = getSplineTangent(spline, true);
        const ourEndTangent = getSplineTangent(spline, false);

        // After normalization by our function (no rotation now)
        expect(ourStartTangent.x).toBeCloseTo(1, 6);
        expect(ourStartTangent.y).toBeCloseTo(0, 6);
        expect(ourEndTangent.x).toBeCloseTo(1, 6);
        expect(ourEndTangent.y).toBeCloseTo(0, 6);
    });
});
