import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    calculateChainOffset,
    calculateOperationLeads,
    calculatePathLeads,
    createCutChain,
    createPathsFromOperation,
    generatePathsForChainWithOperation,
    generatePathsForPartTargetWithOperation,
    getChainCutDirection,
} from './functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Tool } from '$lib/stores/tools/interfaces';
import type { Operation } from './interfaces';
import type { Path } from '$lib/stores/paths/interfaces';
import type { DetectedPart } from '$lib/types';
import { PartType } from '$lib/types';
import { GeometryType } from '$lib/types/geometry';
import { reverseChain } from '$lib/geometry/chain';
import { offsetChain } from '$lib/algorithms/offset-calculation/chain/offset';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import {
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/algorithms/leads/functions';

// Mock dependencies
vi.mock('$lib/geometry/chain', () => ({
    reverseChain: vi.fn(),
    CHAIN_CLOSURE_TOLERANCE: 0.01,
}));

vi.mock('$lib/algorithms/offset-calculation/chain/offset', () => ({
    offsetChain: vi.fn(),
}));

vi.mock('$lib/algorithms/leads/lead-calculation', () => ({
    calculateLeads: vi.fn(() => ({})), // Return empty LeadResult by default
}));

vi.mock('$lib/algorithms/leads/functions', () => ({
    createLeadInConfig: vi.fn(),
    createLeadOutConfig: vi.fn(),
    convertLeadGeometryToPoints: vi.fn(() => []),
}));

describe('Operations Functions', () => {
    const mockChain: Chain = {
        id: 'chain-1',
        clockwise: true,
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            },
        ],
    };

    const mockTool: Tool = {
        id: 'tool-1',
        toolNumber: 1,
        toolName: 'Test Tool',
        kerfWidth: 2.0,
        feedRate: 1000,
        rapidRate: 5000,
        pierceDelay: 0.5,
        pierceHeight: 3.0,
        cutHeight: 1.0,
        arcVoltage: 150.0,
        thcEnable: false,
        gasPressure: 45,
        pauseAtEnd: 0.5,
        puddleJumpHeight: 1.5,
        puddleJumpDelay: 0.1,
        plungeRate: 500,
    };

    const mockOperation: Operation = {
        id: 'op-1',
        name: 'Test Operation',
        toolId: 'tool-1',
        targetType: 'chains',
        targetIds: ['chain-1'],
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            fit: false,
            angle: 45,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 3,
            flipSide: false,
            fit: false,
            angle: 90,
        },
        kerfCompensation: KerfCompensation.NONE,
        holeUnderspeedEnabled: false,
        holeUnderspeedPercent: 50,
    };

    const mockPath: Path = {
        id: 'path-1',
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 45,
            fit: false,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 3,
            flipSide: false,
            angle: 90,
            fit: false,
        },
        kerfCompensation: OffsetDirection.NONE,
        isHole: false,
    };

    const mockPart: DetectedPart = {
        id: 'part-1',
        shell: {
            id: 'shell-1',
            type: PartType.SHELL,
            chain: { id: 'chain-1', clockwise: true, shapes: [] },
            boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
            holes: [],
        },
        holes: [
            {
                id: 'hole-1',
                type: PartType.HOLE,
                chain: { id: 'chain-2', clockwise: false, shapes: [] },
                boundingBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 8 } },
                holes: [],
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getChainCutDirection', () => {
        it('should return NONE when chain is undefined', () => {
            const result = getChainCutDirection(undefined);
            expect(result).toBe(CutDirection.NONE);
        });

        it('should return CLOCKWISE when chain.clockwise is true', () => {
            const result = getChainCutDirection({
                ...mockChain,
                clockwise: true,
            });
            expect(result).toBe(CutDirection.CLOCKWISE);
        });

        it('should return COUNTERCLOCKWISE when chain.clockwise is false', () => {
            const result = getChainCutDirection({
                ...mockChain,
                clockwise: false,
            });
            expect(result).toBe(CutDirection.COUNTERCLOCKWISE);
        });

        it('should return NONE when chain.clockwise is null', () => {
            const result = getChainCutDirection({
                ...mockChain,
                clockwise: null,
            });
            expect(result).toBe(CutDirection.NONE);
        });
    });

    describe('calculateChainOffset', () => {
        beforeEach(() => {
            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: ['Test warning'],
                errors: [],
            });
        });

        it('should return null when kerfCompensation is NONE', () => {
            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.NONE,
                'tool-1',
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null when kerfCompensation is falsy', () => {
            const result = calculateChainOffset(
                mockChain,
                null as unknown as OffsetDirection,
                'tool-1',
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null when toolId is null', () => {
            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                null,
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null and log warning when tool is not found', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'unknown-tool',
                [mockTool]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Tool not found for kerf compensation'
            );
            consoleSpy.mockRestore();
        });

        it('should return null and log warning when tool has no kerf width', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const toolNoKerf = {
                ...mockTool,
                kerfWidth: undefined,
            } as unknown as Tool;

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [toolNoKerf]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Tool "Test Tool" has no kerf width set'
            );
            consoleSpy.mockRestore();
        });

        it('should return null and log warning when tool has zero kerf width', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const toolZeroKerf = { ...mockTool, kerfWidth: 0 };

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [toolZeroKerf]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Tool "Test Tool" has no kerf width set'
            );
            consoleSpy.mockRestore();
        });

        it('should return null and log warning when offset calculation fails', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.mocked(offsetChain).mockReturnValue({
                success: false,
                errors: ['Offset failed'],
                warnings: [],
            });

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Offset calculation failed',
                ['Offset failed']
            );
            consoleSpy.mockRestore();
        });

        it('should return null and log warning when no appropriate offset chain is found for INSET', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'No appropriate offset chain found for direction:',
                OffsetDirection.INSET
            );
            consoleSpy.mockRestore();
        });

        it('should return null and log warning when no appropriate offset chain is found for OUTSET', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.OUTSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'No appropriate offset chain found for direction:',
                OffsetDirection.OUTSET
            );
            consoleSpy.mockRestore();
        });

        it('should handle errors during offset calculation', () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            vi.mocked(offsetChain).mockImplementation(() => {
                throw new Error('Calculation error');
            });

            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error calculating offset:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('should return successful result for INSET direction', () => {
            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toEqual({
                offsetShapes: [mockChain.shapes[0]],
                originalShapes: mockChain.shapes,
                kerfWidth: 2.0,
                gapFills: [],
                warnings: ['Test warning'],
            });
        });

        it('should return successful result for OUTSET direction', () => {
            const result = calculateChainOffset(
                mockChain,
                OffsetDirection.OUTSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toEqual({
                offsetShapes: [mockChain.shapes[0]],
                originalShapes: mockChain.shapes,
                kerfWidth: 2.0,
                gapFills: [],
                warnings: ['Test warning'],
            });
        });
    });

    describe('createCutChain', () => {
        it('should handle user cut direction NONE', () => {
            const result = createCutChain(mockChain, CutDirection.NONE);

            expect(result.cutChain.id).toBe('chain-1-cut');
            expect(result.cutChain.shapes).toHaveLength(1);
            expect(result.executionClockwise).toBeNull();
        });

        it('should handle open chain (natural direction NONE) with CLOCKWISE user direction', () => {
            const openChain = { ...mockChain, clockwise: null };
            const result = createCutChain(openChain, CutDirection.CLOCKWISE);

            expect(result.executionClockwise).toBe(true);
        });

        it('should handle open chain (natural direction NONE) with COUNTERCLOCKWISE user direction', () => {
            const openChain = { ...mockChain, clockwise: null };
            vi.mocked(reverseChain).mockReturnValue({
                id: 'chain-1',
                shapes: [mockChain.shapes[0]],
            });

            const result = createCutChain(
                openChain,
                CutDirection.COUNTERCLOCKWISE
            );

            expect(reverseChain).toHaveBeenCalled();
            expect(result.executionClockwise).toBe(false);
        });

        it('should handle closed chain with user direction opposite to natural', () => {
            const closedChain = { ...mockChain, clockwise: true };
            vi.mocked(reverseChain).mockReturnValue({
                id: 'chain-1',
                shapes: [mockChain.shapes[0]],
            });

            const result = createCutChain(
                closedChain,
                CutDirection.COUNTERCLOCKWISE
            );

            expect(reverseChain).toHaveBeenCalled();
            expect(result.executionClockwise).toBe(false);
        });

        it('should handle closed chain with user direction same as natural', () => {
            const closedChain = { ...mockChain, clockwise: true };
            const result = createCutChain(closedChain, CutDirection.CLOCKWISE);

            expect(reverseChain).not.toHaveBeenCalled();
            expect(result.executionClockwise).toBe(true);
        });

        it('should use offset shapes when provided', () => {
            const offsetShapes = [
                { ...mockChain.shapes[0], id: 'offset-shape-1' },
            ];
            const result = createCutChain(
                mockChain,
                CutDirection.CLOCKWISE,
                offsetShapes
            );

            expect(result.cutChain.shapes[0].id).toBe('offset-shape-1');
        });
    });

    describe('generatePathsForChainWithOperation', () => {
        it('should return empty arrays when chain not found', async () => {
            const result = await generatePathsForChainWithOperation(
                mockOperation,
                'unknown-chain',
                0,
                [mockChain],
                [mockTool],
                []
            );

            expect(result.paths).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate path for chain with kerf compensation INNER', async () => {
            const operationWithKerf = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.INNER,
            };

            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await generatePathsForChainWithOperation(
                operationWithKerf,
                'chain-1',
                0,
                [mockChain],
                [mockTool],
                []
            );

            expect(result.paths).toHaveLength(1);
            expect(result.paths[0].kerfCompensation).toBe(
                OffsetDirection.INSET
            );
        });

        it('should generate path for chain with kerf compensation OUTER', async () => {
            const operationWithKerf = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.OUTER,
            };

            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await generatePathsForChainWithOperation(
                operationWithKerf,
                'chain-1',
                0,
                [mockChain],
                [mockTool],
                []
            );

            expect(result.paths).toHaveLength(1);
            expect(result.paths[0].kerfCompensation).toBe(
                OffsetDirection.OUTSET
            );
        });

        it('should generate path for chain with kerf compensation PART (treated as NONE for chains)', async () => {
            const operationWithKerf = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.PART,
            };

            const result = await generatePathsForChainWithOperation(
                operationWithKerf,
                'chain-1',
                0,
                [mockChain],
                [mockTool],
                []
            );

            expect(result.paths).toHaveLength(1);
            expect(result.paths[0].kerfCompensation).toBe(OffsetDirection.NONE);
        });
    });

    describe('generatePathsForPartTargetWithOperation', () => {
        it('should return empty arrays when part not found', async () => {
            const result = await generatePathsForPartTargetWithOperation(
                mockOperation,
                'unknown-part',
                0,
                [mockChain],
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate paths for part with kerf compensation PART', async () => {
            const operationWithKerf = {
                ...mockOperation,
                targetType: 'parts' as const,
                kerfCompensation: KerfCompensation.PART,
            };

            const chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await generatePathsForPartTargetWithOperation(
                operationWithKerf,
                'part-1',
                0,
                chains,
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toHaveLength(2); // Shell + 1 hole
            expect(result.paths[0].kerfCompensation).toBe(
                OffsetDirection.OUTSET
            ); // Shell
            expect(result.paths[1].kerfCompensation).toBe(
                OffsetDirection.INSET
            ); // Hole
        });

        it('should handle nested holes', async () => {
            const partWithNestedHoles: DetectedPart = {
                ...mockPart,
                holes: [
                    {
                        id: 'hole-1',
                        type: PartType.HOLE,
                        chain: { id: 'chain-2', clockwise: false, shapes: [] },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                        holes: [
                            {
                                id: 'nested-hole-1',
                                type: PartType.HOLE,
                                chain: {
                                    id: 'chain-3',
                                    clockwise: false,
                                    shapes: [],
                                },
                                boundingBox: {
                                    min: { x: 4, y: 4 },
                                    max: { x: 6, y: 6 },
                                },
                                holes: [],
                            },
                        ],
                    },
                ],
            };

            const chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
                {
                    id: 'chain-3',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            const result = await generatePathsForPartTargetWithOperation(
                mockOperation,
                'part-1',
                0,
                chains,
                [partWithNestedHoles],
                [mockTool]
            );

            expect(result.paths).toHaveLength(3); // Shell + 2 holes
        });
    });

    describe('calculatePathLeads', () => {
        beforeEach(() => {
            vi.mocked(createLeadInConfig).mockReturnValue({
                type: LeadType.ARC,
                length: 5,
                angle: 45,
                flipSide: false,
                fit: false,
            });

            vi.mocked(createLeadOutConfig).mockReturnValue({
                type: LeadType.ARC,
                length: 3,
                angle: 90,
                flipSide: false,
                fit: false,
            });

            vi.mocked(calculateLeads).mockReturnValue({
                leadIn: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 1,
                        startAngle: 0,
                        endAngle: Math.PI,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                leadOut: {
                    geometry: {
                        center: { x: 10.5, y: 0.5 },
                        radius: 0.707,
                        startAngle: 225,
                        endAngle: 45,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                warnings: [],
            });
        });

        it('should return empty object when both leads are disabled', async () => {
            const pathNoLeads = {
                ...mockPath,
                leadInConfig: { type: LeadType.NONE, length: 0 },
                leadOutConfig: { type: LeadType.NONE, length: 0 },
            };

            const result = await calculatePathLeads(
                pathNoLeads,
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result).toEqual({});
        });

        it('should calculate leads with offset geometry when available', async () => {
            const pathWithOffset = {
                ...mockPath,
                offset: {
                    offsetShapes: [
                        { ...mockChain.shapes[0], id: 'offset-shape' },
                    ],
                    originalShapes: mockChain.shapes,
                    direction: OffsetDirection.INSET,
                    kerfWidth: 2.0,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            };

            const operationParts = {
                ...mockOperation,
                targetType: 'parts' as const,
            };

            const result = await calculatePathLeads(
                pathWithOffset,
                operationParts,
                mockChain,
                [mockPart]
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'chain-1_offset_temp',
                    shapes: pathWithOffset.offset.offsetShapes,
                }),
                expect.objectContaining({
                    type: LeadType.ARC,
                    length: 5,
                    flipSide: false,
                    angle: 45,
                    fit: false,
                }),
                expect.objectContaining({
                    type: LeadType.ARC,
                    length: 3,
                    flipSide: false,
                    angle: 90,
                    fit: false,
                }),
                mockPath.cutDirection,
                mockPart
            );

            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();
        });

        it('should handle empty offset shapes by using original chain', async () => {
            const pathWithEmptyOffset = {
                ...mockPath,
                calculatedOffset: {
                    offsetShapes: [],
                    originalShapes: mockChain.shapes,
                    direction: OffsetDirection.INSET,
                    kerfWidth: 2.0,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            };

            const result = await calculatePathLeads(
                pathWithEmptyOffset,
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                mockChain,
                expect.anything(),
                expect.anything(),
                mockPath.cutDirection,
                undefined
            );

            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();
        });

        it('should return validation with warnings when lead calculation has warnings', async () => {
            vi.mocked(calculateLeads).mockReturnValue({
                leadIn: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 1,
                        startAngle: 0,
                        endAngle: Math.PI,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                leadOut: {
                    geometry: {
                        center: { x: 10.5, y: 0.5 },
                        radius: 0.707,
                        startAngle: 225,
                        endAngle: 45,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                warnings: ['Test warning'],
            });

            const result = await calculatePathLeads(
                mockPath,
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result.validation?.severity).toBe('warning');
            expect(result.validation?.warnings).toEqual(['Test warning']);
        });

        it('should handle calculation errors', async () => {
            vi.mocked(calculateLeads).mockImplementation(() => {
                throw new Error('Calculation error');
            });

            const result = await calculatePathLeads(
                mockPath,
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result.validation?.isValid).toBe(false);
            expect(result.validation?.severity).toBe('error');
            expect(result.validation?.errors).toEqual(['Calculation error']);
        });

        it('should handle non-Error exceptions', async () => {
            vi.mocked(calculateLeads).mockImplementation(() => {
                throw 'String error';
            });

            const result = await calculatePathLeads(
                mockPath,
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result.validation?.isValid).toBe(false);
            expect(result.validation?.errors).toEqual(['Unknown error']);
        });
    });

    describe('calculateOperationLeads', () => {
        it('should calculate leads for all paths in operation', async () => {
            const paths = [
                mockPath,
                { ...mockPath, id: 'path-2', chainId: 'chain-2' },
            ];
            const chains = [mockChain, { ...mockChain, id: 'chain-2' }];

            vi.mocked(createLeadInConfig).mockReturnValue({
                type: LeadType.ARC,
                length: 5,
                angle: 45,
                flipSide: false,
                fit: false,
            });

            vi.mocked(createLeadOutConfig).mockReturnValue({
                type: LeadType.ARC,
                length: 3,
                angle: 90,
                flipSide: false,
                fit: false,
            });

            vi.mocked(calculateLeads).mockReturnValue({
                leadIn: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 1,
                        startAngle: 0,
                        endAngle: Math.PI,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                leadOut: {
                    geometry: {
                        center: { x: 10.5, y: 0 },
                        radius: 0.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                warnings: [],
            });

            const result = await calculateOperationLeads(
                mockOperation,
                paths,
                chains,
                [mockPart]
            );

            expect(result.size).toBe(2);
            expect(result.has('path-1')).toBe(true);
            expect(result.has('path-2')).toBe(true);
        });

        it('should handle errors during calculation', async () => {
            const consoleSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            vi.mocked(calculateLeads).mockImplementation(() => {
                throw new Error('Calculation error');
            });

            await calculateOperationLeads(
                mockOperation,
                [mockPath],
                [mockChain],
                [mockPart]
            );

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to calculate leads for path'),
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('createPathsFromOperation', () => {
        it('should return empty arrays when operation is disabled', async () => {
            const disabledOperation = { ...mockOperation, enabled: false };

            const result = await createPathsFromOperation(
                disabledOperation,
                [mockChain],
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should return empty arrays when operation has no target IDs', async () => {
            const operationNoTargets = { ...mockOperation, targetIds: [] };

            const result = await createPathsFromOperation(
                operationNoTargets,
                [mockChain],
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate paths for chain targets', async () => {
            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await createPathsFromOperation(
                mockOperation,
                [mockChain],
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should generate paths for part targets', async () => {
            const operationParts = {
                ...mockOperation,
                targetType: 'parts' as const,
                targetIds: ['part-1'],
            };

            const chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(offsetChain).mockReturnValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                    gapFills: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await createPathsFromOperation(
                operationParts,
                chains,
                [mockPart],
                [mockTool]
            );

            expect(result.paths).toHaveLength(2); // Shell + 1 hole
        });
    });
});
