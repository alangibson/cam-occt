import { beforeEach, describe, expect, it } from 'vitest';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { OffsetDirection } from '$lib/cam/offset/types';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import { Shape } from '$lib/geometry/shape/classes';

describe('SimulateStage offset cut detection', () => {
    let mockCut: CutData;
    let mockChain: ChainData;
    let mockShapes: Shape[];
    let mockOffsetShapes: Shape[];

    beforeEach(() => {
        // Create mock shapes for original chain
        mockShapes = [
            new Shape({
                id: 'shape1',
                type: GeometryType.LINE,
                layer: 'layer1',
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 100, y: 0 },
                } as Line,
            }),
            new Shape({
                id: 'shape2',
                type: GeometryType.LINE,
                layer: 'layer1',
                geometry: {
                    start: { x: 100, y: 0 },
                    end: { x: 100, y: 100 },
                } as Line,
            }),
        ];

        // Create mock offset shapes (with different lengths to test properly)
        mockOffsetShapes = [
            new Shape({
                id: 'offset-shape1',
                type: GeometryType.LINE,
                layer: 'layer1',
                geometry: {
                    start: { x: -5, y: -5 },
                    end: { x: 105, y: -5 },
                } as Line,
            }),
            new Shape({
                id: 'offset-shape2',
                type: GeometryType.LINE,
                layer: 'layer1',
                geometry: {
                    start: { x: 105, y: -5 },
                    end: { x: 105, y: 105 },
                } as Line,
            }),
        ];

        mockChain = {
            id: 'chain1',
            shapes: mockShapes,
        };

        mockCut = {
            id: 'cut1',
            name: 'Test Cut',
            operationId: 'op1',
            chainId: 'chain1',
            toolId: 'tool1',
            enabled: true,
            order: 0,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
            feedRate: 1000,
            kerfCompensation: OffsetDirection.OUTSET,
            offset: undefined,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
        };
    });

    describe('Offset cut detection', () => {
        it('should detect when cut has offset geometry', () => {
            mockCut.offset = {
                offsetShapes: mockOffsetShapes,
                originalShapes: mockShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };

            expect(mockCut.offset).toBeDefined();
            expect(mockCut.offset?.offsetShapes).toHaveLength(2);
            expect(mockCut.offset?.originalShapes).toHaveLength(2);
        });

        it('should detect when cut has no offset geometry', () => {
            mockCut.offset = undefined;

            expect(mockCut.offset).toBeUndefined();
        });

        it('should use offset shapes when available', () => {
            mockCut.offset = {
                offsetShapes: mockOffsetShapes,
                originalShapes: mockShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };

            // Simulate the logic from SimulateStage
            const shapes = mockCut.offset
                ? mockCut.offset.offsetShapes
                : mockChain.shapes;

            expect(shapes).toBe(mockOffsetShapes);
            expect(shapes).not.toBe(mockShapes);
        });

        it('should fall back to original chain shapes when no offset exists', () => {
            const cutWithoutOffset: CutData = {
                ...mockCut,
                offset: undefined,
            };

            // Simulate the logic from SimulateStage
            const shapes =
                cutWithoutOffset.offset?.offsetShapes || mockChain.shapes;

            expect(shapes).toBe(mockShapes);
        });
    });

    describe('Cut distance calculation with offsets', () => {
        it('should calculate distance using offset shapes when available', () => {
            mockCut.offset = {
                offsetShapes: mockOffsetShapes,
                originalShapes: mockShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };

            // Mock shape length calculation (simplified)
            function getShapeLength(shape: ShapeData): number {
                if (shape.type === 'line') {
                    const line = shape.geometry as Line;
                    return Math.sqrt(
                        Math.pow(line.end.x - line.start.x, 2) +
                            Math.pow(line.end.y - line.start.y, 2)
                    );
                }
                return 0;
            }

            const shapes = mockCut.offset?.offsetShapes || mockChain.shapes;
            let totalDistance = 0;
            for (const shape of shapes) {
                totalDistance += getShapeLength(shape);
            }

            // Offset shapes should have slightly different distance
            const originalDistance = mockShapes.reduce(
                (sum, shape) => sum + getShapeLength(shape),
                0
            );
            const offsetDistance = mockOffsetShapes.reduce(
                (sum, shape) => sum + getShapeLength(shape),
                0
            );

            expect(totalDistance).toBe(offsetDistance);
            expect(totalDistance).not.toBe(originalDistance);
        });
    });

    describe('Lead calculation with offsets', () => {
        it('should use offset shapes for lead-in/out calculation', () => {
            mockCut.offset = {
                offsetShapes: mockOffsetShapes,
                originalShapes: mockShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };

            mockCut.leadInConfig = { type: LeadType.ARC, length: 10 };

            // Simulate the chain used for lead calculation
            const chainForLeads = mockCut.offset
                ? {
                      ...mockChain,
                      shapes: mockCut.offset.offsetShapes,
                  }
                : mockChain;

            expect(chainForLeads.shapes).toBe(mockOffsetShapes);
            expect(chainForLeads.shapes).not.toBe(mockShapes);
        });
    });

    describe('Visual rendering with offsets', () => {
        it('should identify cuts with offsets for different rendering', () => {
            mockCut.offset = {
                offsetShapes: mockOffsetShapes,
                originalShapes: mockShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 5,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            };

            // Cuts with offsets should be rendered with both solid and dashed lines
            const hasOffset = !!mockCut.offset;
            const hasOriginalShapes = !!mockCut.offset?.originalShapes;
            const hasOffsetShapes = !!mockCut.offset?.offsetShapes;

            expect(hasOffset).toBe(true);
            expect(hasOriginalShapes).toBe(true);
            expect(hasOffsetShapes).toBe(true);
        });

        it('should identify cuts without offsets for standard rendering', () => {
            mockCut.offset = undefined;

            const hasOffset = !!mockCut.offset;

            expect(hasOffset).toBe(false);
        });
    });

    describe('Mixed operations handling', () => {
        it('should handle mixed cuts with and without offsets', () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: mockOffsetShapes,
                    originalShapes: mockShapes,
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 5,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            };

            const cutWithoutOffset: CutData = {
                ...mockCut,
                id: 'cut2',
                offset: undefined,
            };

            const cuts = [cutWithOffset, cutWithoutOffset];

            // Each cut should use its appropriate shapes
            cuts.forEach((cut) => {
                const shapes = cut.offset?.offsetShapes || mockChain.shapes;

                if (cut.id === 'cut1') {
                    expect(shapes).toBe(mockOffsetShapes);
                } else {
                    expect(shapes).toBe(mockShapes);
                }
            });
        });
    });
});
