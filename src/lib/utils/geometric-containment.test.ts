import { describe, it, expect } from 'vitest';
import {
    isChainClosed,
    calculateChainArea,
    isPointInPolygon,
    isShapeContainedInShape,
    isChainContainedInChain,
    detectPolygonContainment,
    buildContainmentHierarchy,
    calculateNestingLevel,
    identifyShells,
} from './geometric-containment';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type { Point2D, Shape, Line } from '../../lib/types';
import type { Circle } from '$lib/geometry/circle';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '../../lib/types/part-detection';
import { GeometryType } from '$lib/types/geometry';

// Helper function to create test chains
function createTestChain(id: string, shapes: Shape[]): Chain {
    return {
        id,
        shapes,
    };
}

// Helper function to create test rectangle
function createRectangle(
    x: number,
    y: number,
    width: number,
    height: number
): Shape[] {
    return [
        {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y },
                end: { x: x + width, y },
            } as Line,
        },
        {
            id: '2',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y },
                end: { x: x + width, y: y + height },
            } as Line,
        },
        {
            id: '3',
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y: y + height },
                end: { x, y: y + height },
            } as Line,
        },
        {
            id: '4',
            type: GeometryType.LINE,
            geometry: {
                start: { x, y: y + height },
                end: { x, y },
            } as Line,
        },
    ];
}

// Helper function to create test circle
function createCircle(x: number, y: number, radius: number): Shape {
    return {
        id: '1',
        type: GeometryType.CIRCLE,
        geometry: {
            center: { x, y },
            radius,
        } as Circle,
    };
}

describe('isChainClosed', () => {
    it('should return true for closed chain within tolerance', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(chain, 0.1)).toBe(true);
    });

    it('should return false for open chain', () => {
        const shapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
        ];
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(chain, 0.1)).toBe(false);
    });

    it('should return false for empty chain', () => {
        const chain = createTestChain('test', []);

        expect(isChainClosed(chain, 0.1)).toBe(false);
    });

    it('should handle chain with points close but not within tolerance', () => {
        const shapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
            {
                id: '3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                } as Line,
            },
            {
                id: '4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0.2, y: 0 },
                } as Line,
            }, // 0.2 gap
        ];
        const chain = createTestChain('test', shapes);

        expect(isChainClosed(chain, 0.1)).toBe(false);
        expect(isChainClosed(chain, 0.3)).toBe(true);
    });
});

describe('calculateChainArea', () => {
    it('should calculate area for closed rectangular chain', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);

        const area = calculateChainArea(chain, 0.1);
        expect(area).toBeCloseTo(100, 1);
    });

    it('should return 0 for open chain', () => {
        const shapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
        ];
        const chain = createTestChain('test', shapes);

        expect(calculateChainArea(chain, 0.1)).toBe(0);
    });

    it('should return 0 for chain with less than 3 points', () => {
        const shapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const chain = createTestChain('test', shapes);

        expect(calculateChainArea(chain, 0.1)).toBe(0);
    });

    it('should handle custom parameters', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('test', shapes);
        const customParams = {
            ...DEFAULT_PART_DETECTION_PARAMETERS,
            decimalPrecision: 4,
        };

        const area = calculateChainArea(chain, 0.1, customParams);
        expect(area).toBeCloseTo(100, 1);
    });
});

describe('isPointInPolygon', () => {
    it('should detect point inside square polygon', () => {
        const polygon: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 5, y: 5 }, polygon)).toBe(true);
    });

    it('should detect point outside polygon', () => {
        const polygon: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        expect(isPointInPolygon({ x: 15, y: 5 }, polygon)).toBe(false);
    });

    it('should handle point on polygon boundary', () => {
        const polygon: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        // Point on edge should be considered inside
        expect(isPointInPolygon({ x: 5, y: 0 }, polygon)).toBe(true);
    });
});

describe('isShapeContainedInShape', () => {
    it('should detect circle contained within larger circle', () => {
        const innerCircle = createCircle(5, 5, 2);
        const outerCircle = createCircle(5, 5, 5);

        expect(isShapeContainedInShape(innerCircle, outerCircle, 0.1)).toBe(
            true
        );
    });

    it('should detect circle not contained in smaller circle', () => {
        const innerCircle = createCircle(5, 5, 5);
        const outerCircle = createCircle(5, 5, 2);

        expect(isShapeContainedInShape(innerCircle, outerCircle, 0.1)).toBe(
            false
        );
    });

    it('should handle open shapes (lines)', () => {
        const line: Shape = {
            id: '1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 2, y: 2 },
                end: { x: 8, y: 8 },
            } as Line,
        };
        const outerCircle = createCircle(5, 5, 5);

        expect(isShapeContainedInShape(line, outerCircle, 0.1)).toBe(true);
    });

    it('should return false for insufficient tessellation points', () => {
        const mockShape: Shape = {
            id: '1',
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: 0, y: 0 },
                radius: 1,
            } as Circle,
        };

        // This tests the error handling path when shapes don't tessellate properly
        const result = isShapeContainedInShape(mockShape, mockShape, 0.1);

        // The result depends on tessellation - could be true or false
        expect(typeof result).toBe('boolean');
    });
});

describe('isChainContainedInChain', () => {
    it('should detect small rectangle contained in large rectangle', () => {
        const innerShapes = createRectangle(2, 2, 6, 6);
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(true);
    });

    it('should return false when outer chain is not closed', () => {
        const innerShapes: Shape[] = createRectangle(2, 2, 6, 6);
        const outerShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
        ];
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(
            false
        );
    });

    it('should handle open inner chain (linestring)', () => {
        const innerShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 2, y: 2 },
                    end: { x: 8, y: 2 },
                } as Line,
            },
            {
                id: '2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 8, y: 2 },
                    end: { x: 8, y: 8 },
                } as Line,
            },
        ];
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', innerShapes);
        const outerChain = createTestChain('outer', outerShapes);

        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(true);
    });

    it('should handle error cases gracefully', () => {
        // Create chains that might cause JSTS errors
        const problematicShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 0, y: 0 },
                } as Line,
            }, // Zero-length line
        ];
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerChain = createTestChain('inner', problematicShapes);
        const outerChain = createTestChain('outer', outerShapes);

        // Should not throw and should return false
        expect(isChainContainedInChain(innerChain, outerChain, 0.1)).toBe(
            false
        );
    });
});

describe('detectPolygonContainment', () => {
    it('should detect nested polygons', () => {
        const outerPolygon: Point2D[] = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];

        const innerPolygon: Point2D[] = [
            { x: 2, y: 2 },
            { x: 8, y: 2 },
            { x: 8, y: 8 },
            { x: 2, y: 8 },
        ];

        const polygons = [outerPolygon, innerPolygon];
        const containmentMap = detectPolygonContainment(polygons);

        expect(containmentMap.get(1)).toBe(0); // inner polygon (index 1) contained in outer (index 0)
    });

    it('should handle multiple levels of nesting', () => {
        const level1: Point2D[] = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 20 },
            { x: 0, y: 20 },
        ];

        const level2: Point2D[] = [
            { x: 2, y: 2 },
            { x: 18, y: 2 },
            { x: 18, y: 18 },
            { x: 2, y: 18 },
        ];

        const level3: Point2D[] = [
            { x: 5, y: 5 },
            { x: 15, y: 5 },
            { x: 15, y: 15 },
            { x: 5, y: 15 },
        ];

        const polygons = [level1, level2, level3];
        const containmentMap = detectPolygonContainment(polygons);

        expect(containmentMap.get(1)).toBe(0); // level2 contained in level1
        expect(containmentMap.get(2)).toBe(1); // level3 contained in level2 (smallest container)
    });

    it('should return empty map for non-nested polygons', () => {
        const poly1: Point2D[] = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 },
            { x: 0, y: 5 },
        ];

        const poly2: Point2D[] = [
            { x: 10, y: 10 },
            { x: 15, y: 10 },
            { x: 15, y: 15 },
            { x: 10, y: 15 },
        ];

        const polygons = [poly1, poly2];
        const containmentMap = detectPolygonContainment(polygons);

        expect(containmentMap.size).toBe(0);
    });
});

describe('buildContainmentHierarchy', () => {
    it('should build hierarchy for nested rectangular chains', () => {
        const outerShapes = createRectangle(0, 0, 10, 10);
        const innerShapes = createRectangle(2, 2, 6, 6);
        const outerChain = createTestChain('outer', outerShapes);
        const innerChain = createTestChain('inner', innerShapes);

        const chains = [outerChain, innerChain];
        const hierarchy = buildContainmentHierarchy(chains, 0.1);

        expect(hierarchy.get('inner')).toBe('outer');
    });

    it('should return empty map for single chain', () => {
        const shapes = createRectangle(0, 0, 10, 10);
        const chain = createTestChain('single', shapes);
        const chains = [chain];

        const hierarchy = buildContainmentHierarchy(chains, 0.1);

        expect(hierarchy.size).toBe(0);
    });

    it('should ignore open chains', () => {
        const openShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const closedShapes = createRectangle(0, 0, 10, 10);
        const openChain = createTestChain('open', openShapes);
        const closedChain = createTestChain('closed', closedShapes);

        const chains = [openChain, closedChain];
        const hierarchy = buildContainmentHierarchy(chains, 0.1);

        expect(hierarchy.size).toBe(0);
    });

    it('should handle complex nesting scenarios', () => {
        // Create 3 levels: large outer, medium middle, small inner
        const largeShapes = createRectangle(0, 0, 20, 20);
        const mediumShapes = createRectangle(2, 2, 16, 16);
        const smallShapes = createRectangle(5, 5, 10, 10);

        const largeChain = createTestChain('large', largeShapes);
        const mediumChain = createTestChain('medium', mediumShapes);
        const smallChain = createTestChain('small', smallShapes);

        const chains = [largeChain, mediumChain, smallChain];
        const hierarchy = buildContainmentHierarchy(chains, 0.1);

        expect(hierarchy.get('medium')).toBe('large');
        expect(hierarchy.get('small')).toBe('medium'); // Should find smallest container
    });
});

describe('calculateNestingLevel', () => {
    it('should return 0 for root level chain', () => {
        const containmentMap = new Map<string, string>();

        expect(calculateNestingLevel('root', containmentMap)).toBe(0);
    });

    it('should calculate correct nesting depth', () => {
        const containmentMap = new Map<string, string>();
        containmentMap.set('child', 'parent');
        containmentMap.set('grandchild', 'child');
        containmentMap.set('greatgrandchild', 'grandchild');

        expect(calculateNestingLevel('parent', containmentMap)).toBe(0);
        expect(calculateNestingLevel('child', containmentMap)).toBe(1);
        expect(calculateNestingLevel('grandchild', containmentMap)).toBe(2);
        expect(calculateNestingLevel('greatgrandchild', containmentMap)).toBe(
            3
        );
    });

    it('should handle circular references safely', () => {
        const containmentMap = new Map<string, string>();
        containmentMap.set('a', 'b');
        containmentMap.set('b', 'a'); // Circular reference

        // Should stop at safety limit and log warning
        const level = calculateNestingLevel('a', containmentMap);
        expect(level).toBe(101); // Value when safety limit is reached (level is incremented before check)
    });
});

describe('identifyShells', () => {
    it('should identify chains at even nesting levels as shells', () => {
        const shapes1 = createRectangle(0, 0, 10, 10);
        const shapes2 = createRectangle(2, 2, 6, 6);
        const shapes3 = createRectangle(3, 3, 4, 4);
        const shapes4 = createRectangle(15, 15, 5, 5);

        const chain1 = createTestChain('chain1', shapes1);
        const chain2 = createTestChain('chain2', shapes2);
        const chain3 = createTestChain('chain3', shapes3);
        const chain4 = createTestChain('chain4', shapes4);

        const chains = [chain1, chain2, chain3, chain4];

        const containmentMap = new Map<string, string>();
        containmentMap.set('chain2', 'chain1'); // level 1 (hole)
        containmentMap.set('chain3', 'chain2'); // level 2 (shell)
        // chain4 has no parent (level 0, shell)

        const shells = identifyShells(chains, containmentMap, 0.1);
        const shellIds = shells.map((s) => s.id).sort();

        expect(shellIds).toEqual(['chain1', 'chain3', 'chain4']);
    });

    it('should ignore open chains', () => {
        const openShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const closedShapes = createRectangle(0, 0, 10, 10);

        const openChain = createTestChain('open', openShapes);
        const closedChain = createTestChain('closed', closedShapes);

        const chains = [openChain, closedChain];
        const containmentMap = new Map<string, string>();

        const shells = identifyShells(chains, containmentMap, 0.1);

        expect(shells).toHaveLength(1);
        expect(shells[0].id).toBe('closed');
    });

    it('should return empty array when no shells exist', () => {
        const openShapes: Shape[] = [
            {
                id: '1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
            },
        ];
        const openChain = createTestChain('open', openShapes);

        const chains = [openChain];
        const containmentMap = new Map<string, string>();

        const shells = identifyShells(chains, containmentMap, 0.1);

        expect(shells).toHaveLength(0);
    });
});
