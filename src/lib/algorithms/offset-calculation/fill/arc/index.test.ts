import { describe, expect, it } from 'vitest';
import type { Arc } from '../../../../geometry/arc';
import { GeometryType, type Shape } from '../../../../../lib/types/geometry';
import { TOLERANCE } from '../../../../constants';
import type { FillOptions } from '../types';
import { fillArcToIntersection } from './index';

describe('fillArcToIntersection', () => {
    const createArcShape = (
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        clockwise: boolean = false
    ): Shape => ({
        id: 'test-arc',
        type: GeometryType.ARC,
        geometry: {
            center: { x: centerX, y: centerY },
            radius,
            startAngle,
            endAngle,
            clockwise,
        } as Arc,
    });

    const defaultOptions: FillOptions = {
        maxExtension: 100,
        tolerance: 1e-6,
        extendDirection: 'auto',
    };

    const pointOnCircle = (
        centerX: number,
        centerY: number,
        radius: number,
        angle: number
    ) => ({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
    });

    describe('basic extension functionality', () => {
        it('should extend arc forward (end direction) for counter-clockwise arc', () => {
            // Quarter circle from 0 to π/2
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                (Math.PI * 3) / 4
            ); // 135 degrees

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.extendedShape).toBeDefined();
            expect(result.extension).toBeDefined();

            const extendedArc = result.extendedShape!.geometry as Arc;
            expect(extendedArc.center).toEqual({ x: 0, y: 0 });
            expect(extendedArc.radius).toBe(10);
            expect(extendedArc.startAngle).toBe(0);
            expect(extendedArc.endAngle).toBeCloseTo((Math.PI * 3) / 4, 5);
            expect(extendedArc.clockwise).toBe(false);

            expect(result.extension!.type).toBe('angular');
            expect(result.extension!.direction).toBe('end');
        });

        it('should extend arc backward (start direction) for counter-clockwise arc', () => {
            // Quarter circle from π/4 to π/2
            const arc = createArcShape(
                0,
                0,
                10,
                Math.PI / 4,
                Math.PI / 2,
                false
            );
            const intersectionPoint = pointOnCircle(0, 0, 10, 0); // 0 degrees

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);

            const extendedArc = result.extendedShape!.geometry as Arc;
            expect(extendedArc.startAngle).toBeCloseTo(0, 5);
            expect(extendedArc.endAngle).toBeCloseTo(Math.PI / 2, 5);

            expect(result.extension!.direction).toBe('start');
        });

        it('should handle clockwise arcs correctly', () => {
            // Clockwise quarter circle from π/2 to 0
            const arc = createArcShape(0, 0, 10, Math.PI / 2, 0, true);
            const intersectionPoint = pointOnCircle(0, 0, 10, -Math.PI / 4); // -45 degrees

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);

            const extendedArc = result.extendedShape!.geometry as Arc;
            expect(extendedArc.clockwise).toBe(true);
            expect(result.extension!.direction).toBe('end');
        });
    });

    describe('direction determination', () => {
        it('should respect explicit start direction', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(0, 0, 10, -Math.PI / 4);

            const result = fillArcToIntersection(arc, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'start',
            });

            expect(result.success).toBe(true);
            expect(result.extension!.direction).toBe('start');
        });

        it('should respect explicit end direction', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                (Math.PI * 3) / 4
            );

            const result = fillArcToIntersection(arc, intersectionPoint, {
                ...defaultOptions,
                extendDirection: 'end',
            });

            expect(result.success).toBe(true);
            expect(result.extension!.direction).toBe('end');
        });

        it('should auto-determine direction based on angular proximity', () => {
            // Arc from π/4 to π/2
            const arc = createArcShape(
                0,
                0,
                10,
                Math.PI / 4,
                Math.PI / 2,
                false
            );

            // Point closer to start should extend start
            const nearStart = pointOnCircle(0, 0, 10, 0);
            const result1 = fillArcToIntersection(
                arc,
                nearStart,
                defaultOptions
            );
            expect(result1.success).toBe(true);
            expect(result1.extension!.direction).toBe('start');

            // Point closer to end should extend end
            const nearEnd = pointOnCircle(0, 0, 10, (Math.PI * 3) / 4);
            const result2 = fillArcToIntersection(arc, nearEnd, defaultOptions);
            expect(result2.success).toBe(true);
            expect(result2.extension!.direction).toBe('end');
        });
    });

    describe('geometric properties preservation', () => {
        it('should preserve arc center and radius', () => {
            const arc = createArcShape(5, 10, 15, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(
                5,
                10,
                15,
                (Math.PI * 3) / 4
            );

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);

            const extendedArc = result.extendedShape!.geometry as Arc;
            expect(extendedArc.center).toEqual({ x: 5, y: 10 });
            expect(extendedArc.radius).toBe(15);
        });

        it('should preserve clockwise direction', () => {
            const arc = createArcShape(0, 0, 10, Math.PI, Math.PI / 2, true);
            const intersectionPoint = pointOnCircle(0, 0, 10, 0);

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);

            const extendedArc = result.extendedShape!.geometry as Arc;
            expect(extendedArc.clockwise).toBe(true);
        });

        it('should calculate angular extension correctly', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(0, 0, 10, Math.PI); // 180 degrees

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.extension!.amount).toBeCloseTo(Math.PI / 2, 5); // Extended by π/2 radians
        });
    });

    describe('error handling', () => {
        it('should reject non-arc shapes', () => {
            const notAnArc: Shape = {
                id: 'test-line',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            };

            const result = fillArcToIntersection(
                notAnArc,
                { x: 15, y: 0 },
                defaultOptions
            );

            expect(result.success).toBe(false);
            expect(result.errors).toContain('Shape must be an arc');
        });

        it('should reject arcs with non-positive radius', () => {
            const invalidArc = createArcShape(0, 0, 0, 0, Math.PI / 2, false); // Zero radius

            const result = fillArcToIntersection(
                invalidArc,
                pointOnCircle(0, 0, 10, Math.PI),
                defaultOptions
            );

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('radius must be positive');
        });

        it('should reject points not on the arc circle', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const offCirclePoint = { x: 15, y: 15 }; // Not on radius 10 circle

            const result = fillArcToIntersection(
                arc,
                offCirclePoint,
                defaultOptions
            );

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('not on arc circle');
        });

        it('should reject extensions beyond maximum angular distance', () => {
            const arc = createArcShape(0, 0, 5, 0, Math.PI / 4, false); // Small radius
            const farPoint = pointOnCircle(0, 0, 5, Math.PI); // Would require large angular extension

            const result = fillArcToIntersection(arc, farPoint, {
                ...defaultOptions,
                maxExtension: 1, // Very small max extension
            });

            expect(result.success).toBe(false);
            expect(result.errors[0]).toContain('exceeds maximum');
        });
    });

    describe('angular calculations', () => {
        it('should handle angle wraparound correctly', () => {
            // Arc from 7π/4 to π/4 (crosses 0)
            const arc = createArcShape(
                0,
                0,
                10,
                (7 * Math.PI) / 4,
                Math.PI / 4,
                false
            );
            const intersectionPoint = pointOnCircle(0, 0, 10, Math.PI / 2);

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            // Should handle the angle wraparound properly
        });

        it('should handle near-full circle extensions', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 6, false); // Small 30-degree arc
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                (11 * Math.PI) / 6
            ); // Nearly full circle extension

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            const extendedArc = result.extendedShape!.geometry as Arc;
            // Should create a large arc but not exceed 2π
            const totalAngle = Math.abs(
                extendedArc.endAngle - extendedArc.startAngle
            );
            expect(totalAngle).toBeLessThanOrEqual(2 * Math.PI + 1e-6);
        });

        it('should calculate extension amount in radians correctly', () => {
            const arc = createArcShape(0, 0, 20, 0, Math.PI / 3, false); // 60 degrees
            const intersectionPoint = pointOnCircle(0, 0, 20, Math.PI / 2); // 90 degrees

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            // Extension should be π/2 - π/3 = π/6 radians
            expect(result.extension!.amount).toBeCloseTo(Math.PI / 6, 5);
        });
    });

    describe('edge cases', () => {
        it('should handle very small arcs', () => {
            const tinyArc = createArcShape(0, 0, 10, 0, 0.001, false); // Tiny arc
            const intersectionPoint = pointOnCircle(0, 0, 10, 0.002);

            const result = fillArcToIntersection(
                tinyArc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.extension!.amount).toBeCloseTo(0.001, 6);
        });

        it('should handle intersection point at arc endpoint', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const endPoint = pointOnCircle(0, 0, 10, Math.PI / 2); // Exactly at end

            const result = fillArcToIntersection(arc, endPoint, defaultOptions);

            expect(result.success).toBe(true);
            expect(result.extension!.amount).toBeCloseTo(0, 6);
        });

        it('should handle machining tolerance precision requirements', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            // Extension by TOLERANCE units = TOLERANCE/radius radians
            const angularExtension = TOLERANCE / 10;
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                Math.PI / 2 + angularExtension
            );

            const result = fillArcToIntersection(arc, intersectionPoint, {
                ...defaultOptions,
                tolerance: 1e-6,
            });

            expect(result.success).toBe(true);
            expect(result.extension!.amount).toBeCloseTo(angularExtension, 6);
        });
    });

    describe('extension metadata', () => {
        it('should provide correct extension metadata for end extension', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                (Math.PI * 3) / 4
            );

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.extension).toBeDefined();

            const ext = result.extension!;
            expect(ext.type).toBe('angular');
            expect(ext.direction).toBe('end');
            expect(ext.amount).toBeCloseTo(Math.PI / 4, 5);
            expect(ext.originalShape).toBe(arc);
            expect(ext.extensionStart).toEqual(
                pointOnCircle(0, 0, 10, Math.PI / 2)
            );
            expect(ext.extensionEnd).toEqual(intersectionPoint);
        });

        it('should provide correct extension metadata for start extension', () => {
            const arc = createArcShape(
                0,
                0,
                10,
                Math.PI / 4,
                Math.PI / 2,
                false
            );
            const intersectionPoint = pointOnCircle(0, 0, 10, 0);

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);

            const ext = result.extension!;
            expect(ext.direction).toBe('start');
            expect(ext.extensionStart).toEqual(
                pointOnCircle(0, 0, 10, Math.PI / 4)
            );
            expect(ext.extensionEnd).toEqual(intersectionPoint);
        });

        it('should have high confidence for successful extensions', () => {
            const arc = createArcShape(0, 0, 10, 0, Math.PI / 2, false);
            const intersectionPoint = pointOnCircle(
                0,
                0,
                10,
                (Math.PI * 3) / 4
            );

            const result = fillArcToIntersection(
                arc,
                intersectionPoint,
                defaultOptions
            );

            expect(result.success).toBe(true);
            expect(result.confidence).toBe(0.95);
            expect(result.warnings).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
        });
    });
});
