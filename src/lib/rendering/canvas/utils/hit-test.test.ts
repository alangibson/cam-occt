/**
 * Tests for hit testing utilities
 */

import { describe, it, expect } from 'vitest';
import {
    HitTestType,
    HitTestUtils,
    DEFAULT_HIT_TEST_PRIORITY,
} from './hit-test';
import type { HitTestResult, HitTestConfig } from './hit-test';

describe('HitTestType enum', () => {
    it('should have all expected hit test types', () => {
        expect(HitTestType.SHAPE).toBe('shape');
        expect(HitTestType.CHAIN).toBe('chain');
        expect(HitTestType.PART).toBe('part');
        expect(HitTestType.PATH).toBe('path');
        expect(HitTestType.RAPID).toBe('rapid');
        expect(HitTestType.LEAD).toBe('lead');
        expect(HitTestType.OVERLAY).toBe('overlay');
    });
});

describe('DEFAULT_HIT_TEST_PRIORITY', () => {
    it('should have rapids as highest priority', () => {
        expect(DEFAULT_HIT_TEST_PRIORITY[0]).toBe(HitTestType.RAPID);
    });

    it('should have shapes as lowest priority', () => {
        expect(
            DEFAULT_HIT_TEST_PRIORITY[DEFAULT_HIT_TEST_PRIORITY.length - 1]
        ).toBe(HitTestType.SHAPE);
    });

    it('should include all hit test types', () => {
        const allTypes = Object.values(HitTestType);
        expect(DEFAULT_HIT_TEST_PRIORITY).toHaveLength(allTypes.length);

        for (const type of allTypes) {
            expect(DEFAULT_HIT_TEST_PRIORITY).toContain(type);
        }
    });
});

describe('HitTestUtils', () => {
    describe('distanceToLineSegment', () => {
        it('should calculate distance to line segment correctly', () => {
            const point = { x: 5, y: 5 };
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: 10, y: 0 };

            const distance = HitTestUtils.distanceToLineSegment(
                point,
                lineStart,
                lineEnd
            );

            expect(distance).toBe(5); // Distance from (5,5) to (5,0)
        });

        it('should return distance to start point when projection is before line', () => {
            const point = { x: -2, y: 3 };
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: 10, y: 0 };

            const distance = HitTestUtils.distanceToLineSegment(
                point,
                lineStart,
                lineEnd
            );

            expect(distance).toBeCloseTo(Math.sqrt(4 + 9)); // Distance to (0,0)
        });

        it('should return distance to end point when projection is after line', () => {
            const point = { x: 12, y: 3 };
            const lineStart = { x: 0, y: 0 };
            const lineEnd = { x: 10, y: 0 };

            const distance = HitTestUtils.distanceToLineSegment(
                point,
                lineStart,
                lineEnd
            );

            expect(distance).toBeCloseTo(Math.sqrt(4 + 9)); // Distance to (10,0)
        });
    });

    describe('distance', () => {
        it('should calculate distance between two points', () => {
            const p1 = { x: 0, y: 0 };
            const p2 = { x: 3, y: 4 };

            const distance = HitTestUtils.distance(p1, p2);

            expect(distance).toBe(5); // 3-4-5 triangle
        });

        it('should return 0 for same points', () => {
            const p1 = { x: 5, y: 10 };
            const p2 = { x: 5, y: 10 };

            const distance = HitTestUtils.distance(p1, p2);

            expect(distance).toBe(0);
        });
    });

    describe('isPointInCircle', () => {
        it('should return true for point inside circle', () => {
            const point = { x: 2, y: 2 };
            const center = { x: 0, y: 0 };
            const radius = 5;

            const result = HitTestUtils.isPointInCircle(point, center, radius);

            expect(result).toBe(true);
        });

        it('should return false for point outside circle', () => {
            const point = { x: 5, y: 5 };
            const center = { x: 0, y: 0 };
            const radius = 5;

            const result = HitTestUtils.isPointInCircle(point, center, radius);

            expect(result).toBe(false);
        });

        it('should return true for point on circle edge', () => {
            const point = { x: 3, y: 4 };
            const center = { x: 0, y: 0 };
            const radius = 5;

            const result = HitTestUtils.isPointInCircle(point, center, radius);

            expect(result).toBe(true);
        });
    });

    describe('isPointInRectangle', () => {
        it('should return true for point inside rectangle', () => {
            const point = { x: 5, y: 5 };
            const rectMin = { x: 0, y: 0 };
            const rectMax = { x: 10, y: 10 };

            const result = HitTestUtils.isPointInRectangle(
                point,
                rectMin,
                rectMax
            );

            expect(result).toBe(true);
        });

        it('should return false for point outside rectangle', () => {
            const point = { x: 15, y: 5 };
            const rectMin = { x: 0, y: 0 };
            const rectMax = { x: 10, y: 10 };

            const result = HitTestUtils.isPointInRectangle(
                point,
                rectMin,
                rectMax
            );

            expect(result).toBe(false);
        });

        it('should return true for point on rectangle edge', () => {
            const point = { x: 10, y: 5 };
            const rectMin = { x: 0, y: 0 };
            const rectMax = { x: 10, y: 10 };

            const result = HitTestUtils.isPointInRectangle(
                point,
                rectMin,
                rectMax
            );

            expect(result).toBe(true);
        });
    });

    describe('isAngleInArcRange', () => {
        it('should return true for angle within counter-clockwise arc', () => {
            const angle = Math.PI / 4; // 45 degrees
            const startAngle = 0; // 0 degrees
            const endAngle = Math.PI / 2; // 90 degrees

            const result = HitTestUtils.isAngleInArcRange(
                angle,
                startAngle,
                endAngle
            );

            expect(result).toBe(true);
        });

        it('should return false for angle outside counter-clockwise arc', () => {
            const angle = Math.PI; // 180 degrees
            const startAngle = 0; // 0 degrees
            const endAngle = Math.PI / 2; // 90 degrees

            const result = HitTestUtils.isAngleInArcRange(
                angle,
                startAngle,
                endAngle
            );

            expect(result).toBe(false);
        });

        it('should handle arc crossing 0 degrees counter-clockwise', () => {
            const angle1 = (7 * Math.PI) / 4; // 315 degrees
            const angle2 = Math.PI / 4; // 45 degrees
            const startAngle = (3 * Math.PI) / 2; // 270 degrees
            const endAngle = Math.PI / 2; // 90 degrees

            const result1 = HitTestUtils.isAngleInArcRange(
                angle1,
                startAngle,
                endAngle
            );
            const result2 = HitTestUtils.isAngleInArcRange(
                angle2,
                startAngle,
                endAngle
            );

            expect(result1).toBe(true);
            expect(result2).toBe(true);
        });

        it('should handle clockwise arcs', () => {
            const angle = (7 * Math.PI) / 4; // 315 degrees
            const startAngle = Math.PI / 2; // 90 degrees
            const endAngle = (3 * Math.PI) / 2; // 270 degrees

            const result = HitTestUtils.isAngleInArcRange(
                angle,
                startAngle,
                endAngle,
                true
            );

            expect(result).toBe(true);
        });
    });

    describe('sortHitResults', () => {
        it('should sort by priority order first', () => {
            const results: HitTestResult[] = [
                {
                    type: HitTestType.SHAPE,
                    id: 'shape1',
                    distance: 1,
                    point: { x: 0, y: 0 },
                },
                {
                    type: HitTestType.RAPID,
                    id: 'rapid1',
                    distance: 5,
                    point: { x: 0, y: 0 },
                },
                {
                    type: HitTestType.PATH,
                    id: 'path1',
                    distance: 2,
                    point: { x: 0, y: 0 },
                },
            ];

            const sorted = HitTestUtils.sortHitResults(results);

            expect(sorted[0].type).toBe(HitTestType.RAPID); // Highest priority
            expect(sorted[1].type).toBe(HitTestType.PATH);
            expect(sorted[2].type).toBe(HitTestType.SHAPE); // Lowest priority
        });

        it('should sort by distance for same priority', () => {
            const results: HitTestResult[] = [
                {
                    type: HitTestType.SHAPE,
                    id: 'shape1',
                    distance: 5,
                    point: { x: 0, y: 0 },
                },
                {
                    type: HitTestType.SHAPE,
                    id: 'shape2',
                    distance: 2,
                    point: { x: 0, y: 0 },
                },
                {
                    type: HitTestType.SHAPE,
                    id: 'shape3',
                    distance: 8,
                    point: { x: 0, y: 0 },
                },
            ];

            const sorted = HitTestUtils.sortHitResults(results);

            expect(sorted[0].distance).toBe(2);
            expect(sorted[1].distance).toBe(5);
            expect(sorted[2].distance).toBe(8);
        });
    });

    describe('filterHitResults', () => {
        const results: HitTestResult[] = [
            {
                type: HitTestType.SHAPE,
                id: 'shape1',
                distance: 2,
                point: { x: 0, y: 0 },
            },
            {
                type: HitTestType.RAPID,
                id: 'rapid1',
                distance: 8,
                point: { x: 0, y: 0 },
            },
            {
                type: HitTestType.PATH,
                id: 'path1',
                distance: 4,
                point: { x: 0, y: 0 },
            },
        ];

        it('should filter by tolerance', () => {
            const config: HitTestConfig = { tolerance: 5 };

            const filtered = HitTestUtils.filterHitResults(results, config);

            expect(filtered).toHaveLength(2);
            expect(filtered.find((r) => r.id === 'rapid1')).toBeUndefined(); // distance > tolerance
        });

        it('should filter by excluded types', () => {
            const config: HitTestConfig = {
                tolerance: 10,
                excludeTypes: [HitTestType.RAPID, HitTestType.PATH],
            };

            const filtered = HitTestUtils.filterHitResults(results, config);

            expect(filtered).toHaveLength(1);
            expect(filtered[0].type).toBe(HitTestType.SHAPE);
        });

        it('should apply both tolerance and type filtering', () => {
            const config: HitTestConfig = {
                tolerance: 3,
                excludeTypes: [HitTestType.SHAPE],
            };

            const filtered = HitTestUtils.filterHitResults(results, config);

            expect(filtered).toHaveLength(0); // Only SHAPE passes tolerance, but it's excluded
        });
    });
});
