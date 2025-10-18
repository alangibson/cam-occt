import { describe, it, expect } from 'vitest';
import { trimCircle } from './index';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { KeepSide } from '$lib/algorithms/offset-calculation/trim/types';

describe('trimCircle', () => {
    const createCircleShape = (center: Point2D, radius: number): Shape => ({
        id: 'test-circle',
        type: GeometryType.CIRCLE,
        geometry: {
            center,
            radius,
        } as Circle,
    });

    describe('successful trim operations', () => {
        it('should trim circle with keepSide "start"', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 10);
            const trimPoint: Point2D = { x: 10, y: 0 }; // Point on circle at angle 0

            const result = trimCircle(circle, trimPoint, 'start', 0.1);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.shape?.type).toBe(GeometryType.ARC);
            expect(result.warnings).toContain(
                'Circle converted to arc for trimming'
            );
            expect(result.errors).toHaveLength(0);
        });

        it('should trim circle with keepSide "before"', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 0, y: 5 }; // Point on circle at angle π/2

            const result = trimCircle(circle, trimPoint, 'before', 0.05);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.shape?.type).toBe(GeometryType.ARC);
            expect(result.warnings).toContain(
                'Circle converted to arc for trimming'
            );
            expect(result.errors).toHaveLength(0);
        });

        it('should trim circle with keepSide "end"', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 3);
            const trimPoint: Point2D = { x: -3, y: 0 }; // Point on circle at angle π

            const result = trimCircle(circle, trimPoint, 'end', 0.1);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.shape?.type).toBe(GeometryType.ARC);
            expect(result.warnings).toContain(
                'Circle converted to arc for trimming'
            );
            expect(result.errors).toHaveLength(0);
        });

        it('should trim circle with keepSide "after"', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 7);
            const trimPoint: Point2D = { x: 0, y: -7 }; // Point on circle at angle -π/2

            const result = trimCircle(circle, trimPoint, 'after', 0.05);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.shape?.type).toBe(GeometryType.ARC);
            expect(result.warnings).toContain(
                'Circle converted to arc for trimming'
            );
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('error conditions', () => {
        it('should fail when trim point is not on circle', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 10, y: 0 }; // Point not on circle

            const result = trimCircle(circle, trimPoint, 'start', 0.1);

            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors).toContain('Trim point is not on the circle');
            expect(result.warnings).toHaveLength(0);
        });

        it('should fail with invalid keepSide value', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 5, y: 0 }; // Point on circle
            const invalidKeepSide = 'invalid' as KeepSide;

            const result = trimCircle(circle, trimPoint, invalidKeepSide, 0.1);

            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors).toContain(
                'Invalid keepSide value for circle trimming: invalid'
            );
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('tolerance handling', () => {
        it('should accept trim point within tolerance', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 5.05, y: 0 }; // Slightly off circle

            const result = trimCircle(circle, trimPoint, 'start', 0.1);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();
            expect(result.errors).toHaveLength(0);
        });

        it('should reject trim point outside tolerance', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 5.2, y: 0 }; // Too far from circle

            const result = trimCircle(circle, trimPoint, 'start', 0.1);

            expect(result.success).toBe(false);
            expect(result.shape).toBeNull();
            expect(result.errors).toContain('Trim point is not on the circle');
        });
    });

    describe('arc geometry validation', () => {
        it('should create arc with correct properties for start/before cases', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 10);
            const trimPoint: Point2D = { x: 10, y: 0 };

            const result = trimCircle(circle, trimPoint, 'start', 0.1);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();

            if (result.shape) {
                const arc = result.shape.geometry as Arc;
                expect(arc.center).toEqual({ x: 0, y: 0 });
                expect(arc.radius).toBe(10);
                expect(arc.clockwise).toBe(false);
                expect(typeof arc.startAngle).toBe('number');
                expect(typeof arc.endAngle).toBe('number');
            }
        });

        it('should create arc with correct properties for end/after cases', () => {
            const circle = createCircleShape({ x: 0, y: 0 }, 5);
            const trimPoint: Point2D = { x: 0, y: 5 };

            const result = trimCircle(circle, trimPoint, 'end', 0.1);

            expect(result.success).toBe(true);
            expect(result.shape).not.toBeNull();

            if (result.shape) {
                const arc = result.shape.geometry as Arc;
                expect(arc.center).toEqual({ x: 0, y: 0 });
                expect(arc.radius).toBe(5);
                expect(arc.clockwise).toBe(false);
                expect(typeof arc.startAngle).toBe('number');
                expect(typeof arc.endAngle).toBe('number');
            }
        });
    });
});
