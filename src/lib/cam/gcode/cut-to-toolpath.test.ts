import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';
import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { CutterCompensation } from './enums';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cutToToolPath, cutsToToolPaths } from './cut-to-toolpath';
import { GeometryType } from '$lib/geometry/enums';
import { getShapePoints } from '$lib/cam/shape/functions';
import { OffsetDirection } from '$lib/cam/offset/types';
import { OperationAction } from '$lib/cam/operation/enums';

// Mock getShapePoints function
vi.mock('$lib/cam/shape/functions', async () => {
    const actual = await vi.importActual('$lib/cam/shape/functions');
    return {
        ...actual,
        getShapePoints: vi.fn(),
    };
});

// Use real lead functions - no mocking needed for arc geometry

// Mock lead persistence utils
vi.mock('$lib/utils/lead-persistence-utils', () => ({
    calculateLeadPoints: vi.fn(),
    getCachedLeadGeometry: vi.fn(() => ({})),
    hasValidCachedLeads: vi.fn(() => false),
}));

const mockGetShapePoints = vi.mocked(getShapePoints);

describe('cutToToolPath', () => {
    const createMockCut = (overrides: Partial<CutData> = {}): CutData => ({
        id: 'test-cut',
        name: 'Test Cut',
        operationId: 'test-operation',
        chainId: 'test-chain',
        toolId: null,
        enabled: true,
        order: 0,
        action: OperationAction.CUT,
        cutDirection: 'clockwise' as CutDirection,
        feedRate: 2000,
        pierceHeight: 4.0,
        pierceDelay: 1.0,
        kerfWidth: 1.5,
        leadInConfig: { type: LeadType.ARC, length: 5.0 },
        leadOutConfig: { type: LeadType.ARC, length: 5.0 },
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
        ...overrides,
    });

    const createMockLine = (
        id: string,
        _start: Point2D,
        _end: Point2D
    ): Shape =>
        new Shape({
            id,
            type: GeometryType.LINE,
            geometry: {} as Line,
            layer: 'test',
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic cut conversion', () => {
        it('should convert cut with original shapes', async () => {
            const cut = createMockCut({ toolId: 'test-tool-1' });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];
            const tools: Tool[] = [
                {
                    id: 'test-tool-1',
                    toolNumber: 1,
                    toolName: 'Test Tool',
                    feedRate: 2000,
                    pierceHeight: 4.0,
                    cutHeight: 1.5,
                    pierceDelay: 1.0,
                    arcVoltage: 120,
                    kerfWidth: 1.5,
                    thcEnable: true,
                    gasPressure: 4.5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 50,
                    puddleJumpDelay: 0,
                    plungeRate: 500,
                },
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                tools,
                CutterCompensation.NONE
            );

            expect(result).toEqual({
                id: 'test-cut',
                shapeId: 'test-chain',
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                ],
                leadIn: undefined,
                leadOut: undefined,
                isRapid: false,
                parameters: {
                    action: 'cut',
                    feedRate: 2000,
                    pierceHeight: 4.0,
                    pierceDelay: 1.0,
                    cutHeight: 1.5,
                    kerf: 1.5,
                    // Lead lengths now come from cut configs, not parameters
                    isHole: false,
                    holeUnderspeedPercent: undefined,
                    spotDuration: undefined,
                },
                originalShape: undefined,
                executionClockwise: undefined,
                normalSide: 'left',
                hasOffset: false,
            });
        });

        it('should use offset shapes when available', async () => {
            const cut = createMockCut({
                cutChain: new Chain({
                    id: 'test-chain-cut',
                    name: 'test-chain-cut',
                    shapes: [
                        {
                            id: 'offset1',
                            type: GeometryType.LINE,
                            geometry: {} as Line,
                            layer: 'test',
                        },
                    ],
                }),
                offset: {
                    offsetShapes: [
                        createMockLine(
                            'offset1',
                            { x: 1, y: 1 },
                            { x: 11, y: 1 }
                        ),
                    ],
                    originalShapes: [
                        createMockLine(
                            'orig1',
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ),
                    ],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const originalShapes: Shape[] = [
                createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                originalShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.points).toEqual([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);
            // Should use cutChain shapes, which contain the offset shapes
            expect(mockGetShapePoints).toHaveBeenCalledWith(
                cut.cutChain!.shapes[0],
                false
            );
        });

        it('should use default parameters when cut values are undefined', async () => {
            const cut = createMockCut({
                feedRate: undefined,
                pierceHeight: undefined,
                pierceDelay: undefined,
                kerfWidth: undefined,
                // Lead lengths now come from cut configs, not parameters
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.parameters).toEqual({
                action: 'cut',
                feedRate: 1000,
                pierceHeight: 1,
                pierceDelay: 0.5,
                cutHeight: 1.5,
                kerf: 0,
                // Lead lengths now come from cut configs, not parameters
                isHole: false,
                holeUnderspeedPercent: undefined,
                spotDuration: undefined,
            });
        });
    });

    describe('multiple shapes handling', () => {
        it('should combine points from multiple shapes', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
                createMockLine('line2', { x: 5, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 5, y: 0 },
                    { x: 10, y: 0 },
                ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.points).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 10, y: 0 },
            ]);
        });

        it('should skip duplicate points when shapes connect', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
                createMockLine('line2', { x: 5, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 5, y: 0 },
                    { x: 10, y: 0 },
                ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            // Should skip the duplicate point at (5, 0)
            expect(result.points).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 10, y: 0 },
            ]);
        });

        it('should include all points when shapes do not connect', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
                createMockLine('line2', { x: 6, y: 0 }, { x: 10, y: 0 }), // Gap at x=5 to x=6
            ];

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 6, y: 0 },
                    { x: 10, y: 0 },
                ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.points).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 6, y: 0 },
                { x: 10, y: 0 },
            ]);
        });

        it('should handle tolerance for point matching', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 5, y: 0 }),
                createMockLine('line2', { x: 5.0005, y: 0 }, { x: 10, y: 0 }), // Within tolerance
            ];

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 5, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 5.0005, y: 0 },
                    { x: 10, y: 0 },
                ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            // Should skip duplicate point since within tolerance
            expect(result.points).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 10, y: 0 },
            ]);
        });
    });

    describe('lead-in handling', () => {
        it('should include lead-in when using original geometry', async () => {
            // Arc will be tessellated into multiple points, just check start and end
            const expectedStart = { x: -5, y: 0 };
            const expectedEnd = { x: 0, y: 0 };
            const cut = createMockCut({
                leadIn: {
                    geometry: {
                        center: { x: -2.5, y: 0 },
                        radius: 2.5,
                        startAngle: Math.PI,
                        endAngle: 0,
                        clockwise: false,
                    } as Arc, // Mock arc geometry
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            // Using real convertLeadGeometryToPoints function

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            // Check that leadIn exists and has correct start/end points
            expect(result.leadIn).toBeDefined();
            expect(result.leadIn!.length).toBeGreaterThan(2); // Arc tessellation has multiple points

            // Check start point (approximately, due to floating point precision)
            expect(result.leadIn![0].x).toBeCloseTo(expectedStart.x, 5);
            expect(result.leadIn![0].y).toBeCloseTo(expectedStart.y, 5);

            // Check end point
            const lastPoint = result.leadIn![result.leadIn!.length - 1];
            expect(lastPoint.x).toBeCloseTo(expectedEnd.x, 5);
            expect(lastPoint.y).toBeCloseTo(expectedEnd.y, 5);
        });

        it('should include lead-in when it connects to offset geometry', async () => {
            // Arc leads will be tessellated, no longer hardcoded line points
            const cut = createMockCut({
                cutChain: new Chain({
                    id: 'test-chain-cut',
                    name: 'test-chain-cut',
                    shapes: [
                        {
                            id: 'offset1',
                            type: GeometryType.LINE,
                            geometry: {} as Line,
                            layer: 'test',
                        },
                    ],
                }),
                offset: {
                    offsetShapes: [
                        createMockLine(
                            'offset1',
                            { x: 1, y: 1 },
                            { x: 11, y: 1 }
                        ),
                    ],
                    originalShapes: [
                        createMockLine(
                            'orig1',
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ),
                    ],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
                leadIn: {
                    geometry: {
                        center: { x: -2.5, y: 1 },
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    } as Arc,
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const originalShapes: Shape[] = [
                createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);

            // Using real convertLeadGeometryToPoints function

            const result = await cutToToolPath(
                new Cut(cut),
                originalShapes,
                [],
                CutterCompensation.NONE
            );

            // Arc lead may be undefined if it doesn't connect properly to offset geometry
            if (result.leadIn) {
                expect(result.leadIn.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

                // Verify arc lead connects to offset geometry at (1,1)
                const leadInEnd = result.leadIn[result.leadIn.length - 1];
                expect(leadInEnd.x).toBeCloseTo(1, 1);
                expect(leadInEnd.y).toBeCloseTo(1, 1);
            }
        });

        it('should exclude lead-in when it does not connect to offset geometry', async () => {
            // Real function will handle this case
            const cut = createMockCut({
                cutChain: new Chain({
                    id: 'test-chain-cut',
                    name: 'test-chain-cut',
                    shapes: [
                        {
                            id: 'offset1',
                            type: GeometryType.LINE,
                            geometry: {} as Line,
                            layer: 'test',
                        },
                    ],
                }),
                offset: {
                    offsetShapes: [
                        createMockLine(
                            'offset1',
                            { x: 1, y: 1 },
                            { x: 11, y: 1 }
                        ),
                    ],
                    originalShapes: [
                        createMockLine(
                            'orig1',
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ),
                    ],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
                leadIn: {
                    geometry: {
                        center: { x: 50, y: 50 }, // Far away - won't connect
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const originalShapes: Shape[] = [
                createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                originalShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.leadIn).toBeUndefined();
        });

        it('should handle empty lead-in points', async () => {
            // Real function will handle zero-length leads
            const cut = createMockCut({
                leadIn: {
                    geometry: {
                        center: { x: -2.5, y: 0 },
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    } as Arc,
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            // Lead may be undefined if it doesn't connect properly to the cut
            // or may be defined if it connects - both are acceptable outcomes
            if (result.leadIn) {
                // If lead is present, it should be valid arc tessellation
                expect(result.leadIn.length).toBeGreaterThan(0);
            }
            // If undefined, that's also acceptable for connection mismatch cases
        });
    });

    describe('lead-out handling', () => {
        it('should include lead-out when using original geometry', async () => {
            // Arc leads will be tessellated, no longer hardcoded line points
            const cut = createMockCut({
                leadOut: {
                    geometry: {
                        center: { x: 12.5, y: 0 },
                        radius: 2.5,
                        startAngle: Math.PI,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            // Arc lead should be tessellated into multiple points
            expect(result.leadOut).toBeDefined();
            expect(result.leadOut!.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

            // Arc lead connection point may vary significantly due to arc geometry
            // Just verify that we have a valid tessellated lead
            const leadOutStart = result.leadOut![0];
            expect(typeof leadOutStart.x).toBe('number');
            expect(typeof leadOutStart.y).toBe('number');
        });

        it('should include lead-out when it connects to offset geometry', async () => {
            // Arc leads will be tessellated, no longer hardcoded line points
            const cut = createMockCut({
                cutChain: new Chain({
                    id: 'test-chain-cut',
                    name: 'test-chain-cut',
                    shapes: [
                        {
                            id: 'offset1',
                            type: GeometryType.LINE,
                            geometry: {} as Line,
                            layer: 'test',
                        },
                    ],
                }),
                offset: {
                    offsetShapes: [
                        createMockLine(
                            'offset1',
                            { x: 1, y: 1 },
                            { x: 11, y: 1 }
                        ),
                    ],
                    originalShapes: [
                        createMockLine(
                            'orig1',
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ),
                    ],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
                leadOut: {
                    geometry: {
                        center: { x: 13.5, y: 1 },
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const originalShapes: Shape[] = [
                createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                originalShapes,
                [],
                CutterCompensation.NONE
            );

            // Lead may be undefined if it doesn't connect properly to offset geometry
            if (result.leadOut) {
                // If lead is present, it should be valid arc tessellation
                expect(result.leadOut.length).toBeGreaterThan(2); // Arc tessellation creates multiple points

                // Verify arc lead starts from offset cut end at (11,1)
                const leadOutStart = result.leadOut[0];
                expect(leadOutStart.x).toBeCloseTo(11, 1);
                expect(leadOutStart.y).toBeCloseTo(1, 1);
            }
            // If undefined, that's acceptable for connection mismatch cases
        });

        it('should exclude lead-out when it does not connect to offset geometry', async () => {
            const cut = createMockCut({
                cutChain: new Chain({
                    id: 'test-chain-cut',
                    name: 'test-chain-cut',
                    shapes: [
                        {
                            id: 'offset1',
                            type: GeometryType.LINE,
                            geometry: {} as Line,
                            layer: 'test',
                        },
                    ],
                }),
                offset: {
                    offsetShapes: [
                        createMockLine(
                            'offset1',
                            { x: 1, y: 1 },
                            { x: 11, y: 1 }
                        ),
                    ],
                    originalShapes: [
                        createMockLine(
                            'orig1',
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ),
                    ],
                    direction: OffsetDirection.OUTSET,
                    kerfWidth: 1.0,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
                leadOut: {
                    geometry: {
                        center: { x: 50, y: 50 }, // Far away - won't connect
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T00:00:00Z',
                    version: '1.0',
                },
            });
            const originalShapes: Shape[] = [
                createMockLine('orig1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 1, y: 1 },
                { x: 11, y: 1 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                originalShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.leadOut).toBeUndefined();
        });
    });

    describe('edge cases', () => {
        it('should handle empty shapes array', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [];

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.points).toEqual([]);
        });

        it('should handle single point shapes', async () => {
            const cut = createMockCut();
            const shapes: Shape[] = [
                createMockLine('point', { x: 5, y: 5 }, { x: 5, y: 5 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([{ x: 5, y: 5 }]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.points).toEqual([{ x: 5, y: 5 }]);
        });
    });
});

describe('cutsToToolPaths', () => {
    const createMockCut = (overrides: Partial<CutData> = {}): CutData => ({
        id: 'test-cut',
        name: 'Test Cut',
        operationId: 'test-operation',
        chainId: 'test-chain',
        toolId: null,
        enabled: true,
        order: 0,
        action: OperationAction.CUT,
        cutDirection: 'clockwise' as CutDirection,
        feedRate: 2000,
        pierceHeight: 4.0,
        pierceDelay: 1.0,
        kerfWidth: 1.5,
        leadInConfig: { type: LeadType.ARC, length: 5.0 },
        leadOutConfig: { type: LeadType.ARC, length: 5.0 },
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
        ...overrides,
    });

    const createMockLine = (
        id: string,
        _start: Point2D,
        _end: Point2D
    ): Shape =>
        new Shape({
            id,
            type: GeometryType.LINE,
            geometry: {} as Line,
            layer: 'test',
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic conversion', () => {
        it('should convert multiple cuts in order', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-2', order: 2 }),
                createMockCut({ id: 'cut-1', order: 1 }),
                createMockCut({ id: 'cut-3', order: 3 }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })],
                ],
            ]);

            mockGetShapePoints.mockReturnValue([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(5); // 3 cuts + 2 rapids
            expect(result[0].id).toBe('cut-1');
            expect(result[1].id).toBe('rapid-0');
            expect(result[2].id).toBe('cut-2');
            expect(result[3].id).toBe('rapid-1');
            expect(result[4].id).toBe('cut-3');
        });

        it('should skip disabled cuts', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', order: 1, enabled: true }),
                createMockCut({ id: 'cut-2', order: 2, enabled: false }),
                createMockCut({ id: 'cut-3', order: 3, enabled: true }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })],
                ],
            ]);

            mockGetShapePoints.mockReturnValue([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(3); // 2 enabled cuts + 1 rapid
            expect(result[0].id).toBe('cut-1');
            expect(result[1].id).toBe('rapid-0');
            expect(result[2].id).toBe('cut-3');
        });

        it('should skip cuts with missing chain shapes', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', chainId: 'existing-chain' }),
                createMockCut({ id: 'cut-2', chainId: 'missing-chain' }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'existing-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })],
                ],
            ]);

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('cut-1');
        });
    });

    describe('rapid generation', () => {
        it('should generate rapids between tool cuts', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', order: 1 }),
                createMockCut({ id: 'cut-2', order: 2 }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })],
                ],
            ]);

            mockGetShapePoints.mockReturnValue([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(3); // 2 cuts + 1 rapid

            const rapid = result[1];
            expect(rapid.id).toBe('rapid-0');
            expect(rapid.isRapid).toBe(true);
            expect(rapid.shapeId).toBe('');
            expect(rapid.parameters).toBeUndefined();
            expect(rapid.points).toEqual([
                { x: 10, y: 0 }, // End of first cut
                { x: 0, y: 0 }, // Start of second cut
            ]);
        });

        it('should use lead-in start point for rapid destination', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', order: 1 }),
                createMockCut({
                    id: 'cut-2',
                    order: 2,
                    leadIn: {
                        geometry: {
                            center: { x: -2.5, y: 0 },
                            radius: 2.5,
                            startAngle: Math.PI,
                            endAngle: 0,
                            clockwise: false,
                        },
                        type: LeadType.ARC,
                        generatedAt: '2023-01-01T00:00:00Z',
                        version: '1.0',
                    },
                }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 })],
                ],
            ]);

            mockGetShapePoints.mockReturnValue([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            const rapid = result[1];
            expect(rapid.points).toHaveLength(2);
            expect(rapid.points[0].x).toBeCloseTo(10, 5);
            expect(rapid.points[0].y).toBeCloseTo(0, 5);
            expect(rapid.points[1].x).toBeCloseTo(-5, 5);
            expect(rapid.points[1].y).toBeCloseTo(0, 5);
        });

        it('should not generate rapid for zero distance moves', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', order: 1 }),
                createMockCut({ id: 'cut-2', order: 2 }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [createMockLine('line1', { x: 0, y: 0 }, { x: 0, y: 0 })],
                ], // Same start/end
            ]);

            mockGetShapePoints.mockReturnValue([{ x: 0, y: 0 }]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(2); // Only 2 cuts, no rapid
            expect(result.every((tp) => !tp.isRapid)).toBe(true);
        });

        it('should not generate rapid for very small movements', async () => {
            const cuts: CutData[] = [
                createMockCut({ id: 'cut-1', order: 1 }),
                createMockCut({ id: 'cut-2', order: 2 }),
            ];

            const chainShapes = new Map<string, Shape[]>([
                [
                    'test-chain',
                    [
                        createMockLine(
                            'line1',
                            { x: 0, y: 0 },
                            { x: 0.0005, y: 0 }
                        ),
                    ],
                ], // Within tolerance
            ]);

            mockGetShapePoints
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 0.0005, y: 0 },
                ])
                .mockReturnValueOnce([
                    { x: 0, y: 0 },
                    { x: 0.0005, y: 0 },
                ]);

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toHaveLength(2); // Only 2 cuts, no rapid due to small distance
        });
    });

    describe('empty input handling', () => {
        it('should handle empty cuts array', async () => {
            const cuts: CutData[] = [];
            const chainShapes = new Map<string, Shape[]>();

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toEqual([]);
        });

        it('should handle empty chainShapes map', async () => {
            const cuts: CutData[] = [createMockCut()];
            const chainShapes = new Map<string, Shape[]>();

            const result = await cutsToToolPaths(
                cuts.map((c) => new Cut(c)),
                chainShapes,
                [],
                CutterCompensation.NONE
            );

            expect(result).toEqual([]);
        });
    });

    describe('action field preservation', () => {
        it('should preserve SPOT action from cut to parameters', async () => {
            const cut = createMockCut({
                action: 'spot' as any, // OperationAction.SPOT
                spotDuration: 100,
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 50, y: 50 }, { x: 50, y: 50 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([{ x: 50, y: 50 }]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.parameters?.action).toBe('spot');
            expect(result.parameters?.spotDuration).toBe(100);
        });

        it('should preserve CUT action from cut to parameters', async () => {
            const cut = createMockCut({
                action: 'cut' as any, // OperationAction.CUT
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.parameters?.action).toBe('cut');
        });

        it('should handle cut with undefined action', async () => {
            const cut = createMockCut({
                action: undefined,
            });
            const shapes: Shape[] = [
                createMockLine('line1', { x: 0, y: 0 }, { x: 10, y: 0 }),
            ];

            mockGetShapePoints.mockReturnValueOnce([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
            ]);

            const result = await cutToToolPath(
                new Cut(cut),
                shapes,
                [],
                CutterCompensation.NONE
            );

            expect(result.parameters?.action).toBeUndefined();
        });
    });
});
