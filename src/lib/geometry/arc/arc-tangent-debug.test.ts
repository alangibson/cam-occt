import { describe, it, expect } from 'vitest';
import { getArcTangent } from './functions';
import type { Arc } from './interfaces';

describe('Arc Tangent Debug', () => {
    it('should calculate tangent correctly for counterclockwise arc at start', () => {
        // Create a simple counterclockwise arc from 0° to 90° (quarter circle)
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0, // 0° = point (10, 0)
            endAngle: Math.PI / 2, // 90° = point (0, 10)
            clockwise: false, // counterclockwise
        };

        // Get tangent at start (should point upward for CCW arc starting at (10,0))
        const tangentAtStart = getArcTangent(arc, true);
        console.log('CCW Arc - Start point: (10, 0)');
        console.log('CCW Arc - Tangent at start:', tangentAtStart);

        // For CCW arc at start angle 0°, tangent should point in positive Y direction (upward)
        expect(tangentAtStart.x).toBeCloseTo(0, 5);
        expect(tangentAtStart.y).toBeCloseTo(1, 5);
    });

    it('should calculate tangent correctly for clockwise arc at start', () => {
        // Create a simple clockwise arc from 0° to -90° (quarter circle)
        const arc: Arc = {
            center: { x: 0, y: 0 },
            radius: 10,
            startAngle: 0, // 0° = point (10, 0)
            endAngle: -Math.PI / 2, // -90° = point (0, -10)
            clockwise: true, // clockwise
        };

        // Get tangent at start (should point downward for CW arc starting at (10,0))
        const tangentAtStart = getArcTangent(arc, true);
        console.log('CW Arc - Start point: (10, 0)');
        console.log('CW Arc - Tangent at start:', tangentAtStart);

        // For CW arc at start angle 0°, tangent should point in negative Y direction (downward)
        expect(tangentAtStart.x).toBeCloseTo(0, 5);
        expect(tangentAtStart.y).toBeCloseTo(-1, 5);
    });

    it('should show the difference between old and new tangent calculation', () => {
        // Test case that would reveal the bug in the original code
        const arc: Arc = {
            center: { x: 100, y: 100 },
            radius: 50,
            startAngle: Math.PI, // 180° = point (50, 100)
            endAngle: Math.PI / 2, // 90° = point (100, 150)
            clockwise: false, // counterclockwise
        };

        const tangentAtStart = getArcTangent(arc, true);
        const tangentAtEnd = getArcTangent(arc, false);

        console.log('=== ARC TANGENT DEBUG ===');
        console.log('Arc center:', arc.center);
        console.log(
            'Arc start angle (radians):',
            arc.startAngle,
            '(degrees:',
            (arc.startAngle * 180) / Math.PI,
            ')'
        );
        console.log(
            'Arc end angle (radians):',
            arc.endAngle,
            '(degrees:',
            (arc.endAngle * 180) / Math.PI,
            ')'
        );
        console.log('Arc clockwise:', arc.clockwise);
        console.log('Tangent at start:', tangentAtStart);
        console.log('Tangent at end:', tangentAtEnd);
        console.log('========================');

        // Just check that tangents are unit vectors
        const startLength = Math.sqrt(
            tangentAtStart.x * tangentAtStart.x +
                tangentAtStart.y * tangentAtStart.y
        );
        const endLength = Math.sqrt(
            tangentAtEnd.x * tangentAtEnd.x + tangentAtEnd.y * tangentAtEnd.y
        );
        expect(startLength).toBeCloseTo(1, 5);
        expect(endLength).toBeCloseTo(1, 5);
    });
});
