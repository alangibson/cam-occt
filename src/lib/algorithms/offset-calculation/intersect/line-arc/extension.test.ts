import { describe, test, expect } from 'vitest';
import type { Line, Arc } from '$lib/types/geometry';
import { findLineArcIntersections } from './index';

describe('Line-Arc Extension Intersections', () => {
    test('should find intersection with extended line', () => {
        // Line that would miss the arc without extension
        const line: Line = {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
        };

        // Arc positioned above the line
        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: Math.PI,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findLineArcIntersections(line, arc, false, false);
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where extended line meets arc
        const withExtensions = findLineArcIntersections(
            line,
            arc,
            false,
            true,
            1000
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should find intersection with extended arc', () => {
        // Line positioned to intersect with an extended arc
        const line: Line = {
            start: { x: 0, y: 5 },
            end: { x: 30, y: 5 },
        };

        // Short arc that doesn't reach the line without extension - small arc in upper right
        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: Math.PI / 4, // 45 degrees
            endAngle: Math.PI / 3, // 60 degrees - small arc
            clockwise: false,
        };

        // Without extensions - should find no intersections (arc doesn't cover the intersection points)
        const noExtensions = findLineArcIntersections(line, arc, false, false);
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where extended arc meets line
        const withExtensions = findLineArcIntersections(
            line,
            arc,
            false,
            true,
            20
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should find intersection with both extended shapes', () => {
        // Line that is too short to reach the arc
        const line: Line = {
            start: { x: 0, y: 5 },
            end: { x: 5, y: 5 },
        };

        // Short arc positioned away from the short line
        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: Math.PI / 4, // 45 degrees
            endAngle: Math.PI / 3, // 60 degrees - small arc
            clockwise: false,
        };

        // Without extensions - should find no intersections
        const noExtensions = findLineArcIntersections(line, arc, false, false);
        expect(noExtensions).toHaveLength(0);

        // With extensions - should find intersection where both shapes are extended
        const withExtensions = findLineArcIntersections(
            line,
            arc,
            false,
            true,
            20
        );
        expect(withExtensions.length).toBeGreaterThan(0);

        // Verify the intersection is marked as being on an extension
        const intersection = withExtensions[0];
        expect(intersection.onExtension).toBe(true);
    });

    test('should return original intersections when they exist', () => {
        // Line and arc that intersect normally
        const line: Line = {
            start: { x: 0, y: 5 },
            end: { x: 30, y: 5 },
        };

        const arc: Arc = {
            center: { x: 15, y: 5 },
            radius: 5,
            startAngle: 0,
            endAngle: 2 * Math.PI,
            clockwise: false,
        };

        // Should find 2 intersections (line passes through circle)
        const intersections = findLineArcIntersections(
            line,
            arc,
            false,
            true,
            1000
        );
        expect(intersections).toHaveLength(2);

        // These should not be marked as extensions since they exist on original shapes
        intersections.forEach((intersection) => {
            expect(intersection.onExtension || false).toBe(false);
        });
    });
});
