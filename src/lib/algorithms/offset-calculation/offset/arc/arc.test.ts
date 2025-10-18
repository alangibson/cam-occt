import { describe, expect, it } from 'vitest';
import { offsetArc } from './arc';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';

describe('offsetArc', () => {
    const testArc: Arc = {
        center: { x: 0, y: 0 },
        radius: 10,
        startAngle: 0,
        endAngle: Math.PI / 2,
        clockwise: false,
    };

    it('should return no shapes when direction is none', () => {
        const result = offsetArc(testArc, 5, OffsetDirection.NONE);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(0);
    });

    it('should offset arc outward by increasing radius', () => {
        const result = offsetArc(testArc, 3, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(1);

        const offsetGeometry = result.shapes[0].geometry as Arc;
        expect(offsetGeometry.center.x).toBe(0);
        expect(offsetGeometry.center.y).toBe(0);
        expect(offsetGeometry.radius).toBe(13); // Original radius + offset
        expect(offsetGeometry.startAngle).toBe(testArc.startAngle);
        expect(offsetGeometry.endAngle).toBe(testArc.endAngle);
        expect(offsetGeometry.clockwise).toBe(testArc.clockwise);
    });

    it('should offset arc inward by decreasing radius', () => {
        const result = offsetArc(testArc, 3, OffsetDirection.INSET);
        expect(result.success).toBe(true);
        expect(result.shapes).toHaveLength(1);

        const offsetGeometry = result.shapes[0].geometry as Arc;
        expect(offsetGeometry.radius).toBe(7); // Original radius - offset
    });

    it('should fail when inset would create negative radius', () => {
        const result = offsetArc(testArc, 15, OffsetDirection.INSET); // 15 > 10 (original radius)
        expect(result.success).toBe(false);
        expect(result.errors[0]).toContain('negative radius');
    });

    it('should maintain consistent perpendicular distance for all arc types', () => {
        // Test various arc configurations including different sweep angles
        const testConfigs = [
            {
                name: '90-degree arc',
                arc: {
                    center: { x: 100, y: 100 },
                    radius: 50,
                    startAngle: Math.PI / 4,
                    endAngle: (3 * Math.PI) / 4,
                    clockwise: false,
                },
            },
            {
                name: '180-degree semicircle',
                arc: {
                    center: { x: 200, y: 100 },
                    radius: 60,
                    startAngle: 0,
                    endAngle: Math.PI,
                    clockwise: false,
                },
            },
            {
                name: '270-degree arc',
                arc: {
                    center: { x: 300, y: 200 },
                    radius: 40,
                    startAngle: 0,
                    endAngle: (3 * Math.PI) / 2,
                    clockwise: false,
                },
            },
            {
                name: '120-degree symmetric arc',
                arc: {
                    center: { x: 150, y: 150 },
                    radius: 80,
                    startAngle: -Math.PI / 3,
                    endAngle: Math.PI / 3,
                    clockwise: false,
                },
            },
        ];

        testConfigs.forEach((config) => {
            const offsetDistance = 15;

            // Test outset
            const outsetResult = offsetArc(
                config.arc,
                offsetDistance,
                OffsetDirection.OUTSET
            );
            expect(outsetResult.success).toBe(true);
            const outsetArc = outsetResult.shapes[0].geometry as Arc;
            expect(outsetArc.radius).toBe(config.arc.radius + offsetDistance);
            expect(outsetArc.center).toEqual(config.arc.center);
            expect(outsetArc.startAngle).toBe(config.arc.startAngle);
            expect(outsetArc.endAngle).toBe(config.arc.endAngle);
            expect(outsetArc.clockwise).toBe(config.arc.clockwise);

            // Test inset
            const insetResult = offsetArc(
                config.arc,
                offsetDistance,
                OffsetDirection.INSET
            );
            expect(insetResult.success).toBe(true);
            const insetArc = insetResult.shapes[0].geometry as Arc;
            expect(insetArc.radius).toBe(config.arc.radius - offsetDistance);
            expect(insetArc.center).toEqual(config.arc.center);
            expect(insetArc.startAngle).toBe(config.arc.startAngle);
            expect(insetArc.endAngle).toBe(config.arc.endAngle);
            expect(insetArc.clockwise).toBe(config.arc.clockwise);

            // Verify that the perpendicular distance is maintained at any point
            // For arcs, the perpendicular distance equals the radius difference
            const testAngles = [
                config.arc.startAngle,
                config.arc.endAngle,
                (config.arc.startAngle + config.arc.endAngle) / 2,
            ];

            testAngles.forEach((angle) => {
                // Original point
                const origX =
                    config.arc.center.x + config.arc.radius * Math.cos(angle);
                const origY =
                    config.arc.center.y + config.arc.radius * Math.sin(angle);

                // Outset point
                const outsetX =
                    config.arc.center.x + outsetArc.radius * Math.cos(angle);
                const outsetY =
                    config.arc.center.y + outsetArc.radius * Math.sin(angle);

                // Calculate distance
                const outsetDist = Math.sqrt(
                    (outsetX - origX) ** 2 + (outsetY - origY) ** 2
                );
                expect(outsetDist).toBeCloseTo(offsetDistance, 10);

                // Inset point
                const insetX =
                    config.arc.center.x + insetArc.radius * Math.cos(angle);
                const insetY =
                    config.arc.center.y + insetArc.radius * Math.sin(angle);

                // Calculate distance
                const insetDist = Math.sqrt(
                    (insetX - origX) ** 2 + (insetY - origY) ** 2
                );
                expect(insetDist).toBeCloseTo(offsetDistance, 10);
            });
        });
    });

    it('should handle large sweep angles correctly', () => {
        // Test 270-degree arc (should use large-arc-flag = 1 in SVG)
        const largeArc: Arc = {
            center: { x: 100, y: 100 },
            radius: 50,
            startAngle: 0,
            endAngle: (3 * Math.PI) / 2, // 270 degrees
            clockwise: false,
        };

        const offsetDistance = 10;

        // Test outset
        const outsetResult = offsetArc(
            largeArc,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        expect(outsetResult.success).toBe(true);

        const outsetArc = outsetResult.shapes[0].geometry as Arc;
        expect(outsetArc.radius).toBe(60);
        expect(outsetArc.startAngle).toBe(0);
        expect(outsetArc.endAngle).toBe((3 * Math.PI) / 2);

        // Verify angular span is preserved
        const originalSpan = largeArc.endAngle - largeArc.startAngle;
        const offsetSpan = outsetArc.endAngle - outsetArc.startAngle;
        expect(offsetSpan).toBeCloseTo(originalSpan, 10);
    });

    it('should handle 180-degree semicircle correctly', () => {
        // Test semicircle (exactly 180 degrees)
        const semicircle: Arc = {
            center: { x: 200, y: 150 },
            radius: 75,
            startAngle: 0,
            endAngle: Math.PI, // Exactly 180 degrees
            clockwise: false,
        };

        const offsetDistance = 25;

        // Test both directions
        const outsetResult = offsetArc(
            semicircle,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        const insetResult = offsetArc(
            semicircle,
            offsetDistance,
            OffsetDirection.INSET
        );

        expect(outsetResult.success).toBe(true);
        expect(insetResult.success).toBe(true);

        const outsetArc = outsetResult.shapes[0].geometry as Arc;
        const insetArc = insetResult.shapes[0].geometry as Arc;

        // Check radii
        expect(outsetArc.radius).toBe(100);
        expect(insetArc.radius).toBe(50);

        // Check that angles are exactly preserved
        expect(outsetArc.startAngle).toBe(0);
        expect(outsetArc.endAngle).toBe(Math.PI);
        expect(insetArc.startAngle).toBe(0);
        expect(insetArc.endAngle).toBe(Math.PI);
    });

    it('should handle arc with zero radius', () => {
        const zeroArc: Arc = {
            center: { x: 0, y: 0 },
            radius: 0,
            startAngle: 0,
            endAngle: Math.PI,
            clockwise: false,
        };

        const result = offsetArc(zeroArc, 1, OffsetDirection.OUTSET);
        expect(result.success).toBe(true);
        // Zero radius arc becomes a 1-unit radius arc
        const offsetGeometry = result.shapes[0].geometry as Arc;
        expect(offsetGeometry.radius).toBe(1);
    });

    it('should maintain arc properties with radius offset', () => {
        const originalArc: Arc = {
            center: { x: 0, y: 0 },
            radius: 8,
            startAngle: 0,
            endAngle: Math.PI / 2,
            clockwise: false,
        };

        const offsetDistance = 3;
        const result = offsetArc(
            originalArc,
            offsetDistance,
            OffsetDirection.OUTSET
        );
        expect(result.success).toBe(true);

        const offsetGeometry = result.shapes[0].geometry as Arc;

        // Check radius accuracy
        expect(offsetGeometry.radius).toBeCloseTo(11, 10);

        // Check that all other properties are preserved
        expect(offsetGeometry.center.x).toBeCloseTo(originalArc.center.x, 10);
        expect(offsetGeometry.center.y).toBeCloseTo(originalArc.center.y, 10);
        expect(offsetGeometry.startAngle).toBeCloseTo(
            originalArc.startAngle,
            10
        );
        expect(offsetGeometry.endAngle).toBeCloseTo(originalArc.endAngle, 10);
        expect(offsetGeometry.clockwise).toBe(originalArc.clockwise);
    });
});
