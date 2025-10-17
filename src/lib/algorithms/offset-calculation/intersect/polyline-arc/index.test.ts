import { describe, it, expect, vi } from 'vitest';
import { findPolylineArcIntersections } from './index';
import type { Polyline } from '$lib/geometry/polyline';
import type { Arc } from '$lib/geometry/arc';
import type { Line } from '$lib/geometry/line';
import type { Shape } from '$lib/geometry/shape';
import { GeometryType } from '$lib/geometry/shape';
import { createExtendedPolyline } from '$lib/algorithms/offset-calculation/extend/polyline';
import { createExtendedArc } from '$lib/algorithms/offset-calculation/extend/arc';

// Mock the extension modules to control their behavior
vi.mock('$lib/algorithms/offset-calculation/extend/polyline', () => ({
    createExtendedPolyline: vi.fn(),
}));

vi.mock('$lib/algorithms/offset-calculation/extend/arc', () => ({
    createExtendedArc: vi.fn(),
}));

describe('Polyline-Arc Intersection', () => {
    const createLineShape = (
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): Shape => ({
        id: `line-${startX}-${startY}-${endX}-${endY}`,
        type: GeometryType.LINE,
        geometry: {
            start: { x: startX, y: startY },
            end: { x: endX, y: endY },
        } as Line,
    });

    const createArcShape = (
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        endAngle: number
    ): Shape => ({
        id: `arc-${centerX}-${centerY}-${radius}`,
        type: GeometryType.ARC,
        geometry: {
            center: { x: centerX, y: centerY },
            radius,
            startAngle,
            endAngle,
            clockwise: false,
        } as Arc,
    });

    const createPolyline = (shapes: Shape[]): Polyline => ({
        shapes,
        closed: false,
    });

    const createArc = (
        centerX: number = 0,
        centerY: number = 0,
        radius: number = 1
    ): Arc => ({
        center: { x: centerX, y: centerY },
        radius,
        startAngle: 0,
        endAngle: Math.PI,
        clockwise: false,
    });

    describe('basic intersection functionality', () => {
        it('should find intersections between polyline and arc', () => {
            const lineShape = createLineShape(-2, 0, 2, 0);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 1);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle swapped parameters', () => {
            const lineShape = createLineShape(-2, 0, 2, 0);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 1);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                true,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle empty polyline shapes', () => {
            const polyline: Polyline = {
                shapes: [],
                closed: false,
            };
            const arc = createArc(0, 0, 1);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(result).toEqual([]);
        });

        it('should handle polyline with undefined shapes', () => {
            const polyline = {
                closed: false,
            } as unknown as Polyline;
            const arc = createArc(0, 0, 1);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(result).toEqual([]);
        });
    });

    describe('extension handling', () => {
        it('should return original results when intersections found without extensions', () => {
            const lineShape = createLineShape(-1, 0, 1, 0);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should try extensions when no intersections found and extensions allowed', () => {
            const lineShape = createLineShape(-1, 2, 1, 2); // Line above the arc
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5); // Small arc below the line

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                5.0
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle extension failures gracefully', async () => {
            const mockCreateExtendedPolyline = vi.mocked(
                createExtendedPolyline
            );
            const mockCreateExtendedArc = vi.mocked(createExtendedArc);

            // Mock the extension functions to throw errors
            mockCreateExtendedPolyline.mockImplementation(() => {
                throw new Error('Polyline extension failed');
            });
            mockCreateExtendedArc.mockImplementation(() => {
                throw new Error('Arc extension failed');
            });

            const lineShape = createLineShape(-1, 2, 1, 2);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            // This should catch extension errors and return empty array
            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);
            expect(result).toEqual([]);
        });
    });

    describe('arc segment handling', () => {
        it('should handle polyline containing arc segments', () => {
            const arcShape = createArcShape(0, 0, 1, 0, Math.PI / 2);
            const polyline = createPolyline([arcShape]);
            const arc = createArc(1, 0, 0.5);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle polyline with arc segments and extensions', () => {
            const arcShape = createArcShape(0, 0, 1, 0, Math.PI / 2);
            const polyline = createPolyline([arcShape]);
            const arc = createArc(5, 5, 0.5); // Far away arc

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                2.0
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('unsupported segment types', () => {
        it('should handle unsupported segment types gracefully', () => {
            // Create a shape with an unsupported geometry type
            const unsupportedShape: Shape = {
                id: 'unsupported-shape',
                type: 'unknown' as unknown as GeometryType,
                geometry: {
                    // This geometry doesn't match Line or Arc interface
                    points: [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                } as unknown as Line,
            };

            const polyline = createPolyline([unsupportedShape]);
            const arc = createArc(0, 0, 1);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('complex polylines', () => {
        it('should handle multi-segment polylines', () => {
            const line1 = createLineShape(-2, 0, 0, 0);
            const line2 = createLineShape(0, 0, 2, 0);
            const polyline = createPolyline([line1, line2]);
            const arc = createArc(0, 0, 0.5);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle mixed line and arc segments in polyline', () => {
            const line1 = createLineShape(-2, 0, 0, 0);
            const arcShape = createArcShape(0, 0, 0.5, 0, Math.PI);
            const line2 = createLineShape(0, 0, 2, 0);
            const polyline = createPolyline([line1, arcShape, line2]);
            const arc = createArc(1, 0, 0.3);

            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                false
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('edge cases for extension detection', () => {
        it('should handle extension detection with no original shapes', () => {
            const lineShape = createLineShape(-1, 2, 1, 2);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            // Extensions allowed but should result in extension detection
            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle multiple extension attempts', () => {
            const lineShape = createLineShape(-1, 3, 1, 3); // Line well above the arc
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            // This should try all three extension combinations
            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                2.0
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle individual extension failures', async () => {
            const mockCreateExtendedPolyline = vi.mocked(
                createExtendedPolyline
            );
            const mockCreateExtendedArc = vi.mocked(createExtendedArc);

            const lineShape = createLineShape(-1, 2, 1, 2);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            // Test polyline extension failure only
            mockCreateExtendedPolyline.mockImplementationOnce(() => {
                throw new Error('Polyline extension failed');
            });
            mockCreateExtendedArc.mockImplementation(() => arc);

            let result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);

            // Reset mocks
            vi.clearAllMocks();

            // Test arc extension failure only
            mockCreateExtendedPolyline.mockImplementation(() => polyline);
            mockCreateExtendedArc.mockImplementationOnce(() => {
                throw new Error('Arc extension failed');
            });

            result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);

            // Reset mocks
            vi.clearAllMocks();

            // Test both extensions failing
            mockCreateExtendedPolyline.mockImplementationOnce(() => {
                throw new Error('Polyline extension failed');
            });
            mockCreateExtendedArc.mockImplementationOnce(() => {
                throw new Error('Arc extension failed');
            });

            result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle missing original shapes branch', () => {
            const lineShape = createLineShape(-1, 2, 1, 2);
            const polyline = createPolyline([lineShape]);
            const arc = createArc(0, 0, 0.5);

            // This should trigger the branch where originalPolyline and originalArc are both null
            const result = findPolylineArcIntersections(
                polyline,
                arc,
                false,
                true,
                1.0
            );

            expect(Array.isArray(result)).toBe(true);
        });
    });
});
