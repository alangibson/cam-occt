import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';
import { generateCutsForChainsWithOperation } from '$lib/cam/pipeline/operations/chain-operations';
import { generateCutsForPartsWithOperation } from '$lib/cam/pipeline/operations/part-operations';
import { calculateChainOffset } from '$lib/cam/pipeline/operations/offset-calculation';
import {
    calculateOperationLeads,
    calculateCutLeads,
} from '$lib/cam/pipeline/leads/lead-orchestration';
import { createCutChain } from '$lib/cam/pipeline/chains/functions';
import { getChainCutDirection, reverseChain } from '$lib/cam/chain/functions';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { KerfCompensation, OperationAction } from '$lib/cam/operation/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { PartData } from '$lib/cam/part/interfaces';
import { Part } from '$lib/cam/part/classes.svelte';
import { PartType } from '$lib/cam/part/enums';
import { GeometryType } from '$lib/geometry/enums';
import { offsetChain as polylineOffset } from '$lib/cam/offset';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import {
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/cam/lead/functions';

// Helper function to create Operation with resolved references
function createOperation(
    data: OperationData,
    tool: Tool | null,
    targets: (ChainData | Part)[]
): Operation {
    const operation = new Operation(data);
    operation.setTool(tool);
    operation.setTargets(targets);
    return operation;
}

// Mock dependencies
vi.mock('$lib/cam/chain/functions', () => ({
    reverseChain: vi.fn(),
    getChainCutDirection: vi.fn((chain) => {
        if (!chain) return CutDirection.NONE;
        return chain.clockwise === true
            ? CutDirection.CLOCKWISE
            : chain.clockwise === false
              ? CutDirection.COUNTERCLOCKWISE
              : CutDirection.NONE;
    }),
    getChainStartPoint: vi.fn(
        (chain) => chain.shapes[0]?.geometry?.start || { x: 0, y: 0 }
    ),
    getChainEndPoint: vi.fn((chain) => {
        const lastShape = chain.shapes[chain.shapes.length - 1];
        return lastShape?.geometry?.end || { x: 0, y: 0 };
    }),
    getChainPoints: vi.fn((chain) =>
        chain.shapes.flatMap((s: ShapeData) => [
            (s.geometry as { start: { x: number; y: number } }).start,
            (s.geometry as { end: { x: number; y: number } }).end,
        ])
    ),
    tessellateChain: vi.fn((chain) =>
        chain.shapes.flatMap((s: ShapeData) => [
            (s.geometry as { start: { x: number; y: number } }).start,
            (s.geometry as { end: { x: number; y: number } }).end,
        ])
    ),
    getChainTangent: vi.fn(() => ({ x: 1, y: 0 })),
    isChainClosed: vi.fn((chain) => chain?.closed ?? false),
}));

vi.mock('$lib/cam/chain/constants', () => ({
    CHAIN_CLOSURE_TOLERANCE: 0.01,
}));

vi.mock('$lib/cam/offset', () => ({
    offsetChain: vi.fn(),
}));

vi.mock('$lib/cam/lead/lead-calculation', () => ({
    calculateLeads: vi.fn(() => ({})), // Return empty LeadResult by default
}));

vi.mock('$lib/cam/lead/functions', () => ({
    createLeadInConfig: vi.fn(),
    createLeadOutConfig: vi.fn(),
    convertLeadGeometryToPoints: vi.fn(() => []),
}));

describe('Operations Functions', () => {
    const mockChainData: ChainData = {
        id: 'chain-1',
        name: 'chain-1',
        clockwise: true,
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            },
        ],
    };

    const mockChain = new Chain(mockChainData);

    const mockTool: Tool = {
        id: 'tool-1',
        toolNumber: 1,
        toolName: 'Test Tool',
        kerfWidth: 2.0,
        feedRate: 1000,
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

    const mockOperation: OperationData = {
        id: 'op-1',
        name: 'Test Operation',
        action: OperationAction.CUT,
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

    const mockCut: CutData = {
        id: 'cut-1',
        name: 'Test Cut',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        action: OperationAction.CUT,
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
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
    };

    const mockPartData: PartData = {
        id: 'part-1',
        name: 'part-1',
        type: PartType.SHELL,
        shell: { id: 'chain-1', name: 'chain-1', clockwise: true, shapes: [] },
        boundingBox: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
        voids: [
            {
                id: 'hole-1',
                type: PartType.HOLE,
                chain: {
                    id: 'chain-2',
                    name: 'chain-2',
                    clockwise: false,
                    shapes: [],
                },
                boundingBox: { min: { x: 2, y: 2 }, max: { x: 8, y: 8 } },
            },
        ],
        slots: [],
        layerName: '0',
    };

    const mockPart = new Part(mockPartData);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getChainCutDirection', () => {
        it('should return NONE when chain is undefined', () => {
            const result = getChainCutDirection(undefined);
            expect(result).toBe(CutDirection.NONE);
        });

        it('should return CLOCKWISE when chain.clockwise is true', () => {
            const result = getChainCutDirection(
                new Chain({
                    ...mockChainData,
                    clockwise: true,
                })
            );
            expect(result).toBe(CutDirection.CLOCKWISE);
        });

        it('should return COUNTERCLOCKWISE when chain.clockwise is false', () => {
            const result = getChainCutDirection(
                new Chain({
                    ...mockChainData,
                    clockwise: false,
                })
            );
            expect(result).toBe(CutDirection.COUNTERCLOCKWISE);
        });

        it('should return NONE when chain.clockwise is null', () => {
            const result = getChainCutDirection(
                new Chain({
                    ...mockChainData,
                    clockwise: null,
                })
            );
            expect(result).toBe(CutDirection.NONE);
        });
    });

    describe('calculateChainOffset', () => {
        beforeEach(() => {
            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: ['Test warning'],
                errors: [],
            });
        });

        it('should return null when kerfCompensation is NONE', async () => {
            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.NONE,
                'tool-1',
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null when kerfCompensation is falsy', async () => {
            const result = await calculateChainOffset(
                mockChain,
                null as unknown as OffsetDirection,
                'tool-1',
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null when toolId is null', async () => {
            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                null,
                [mockTool]
            );
            expect(result).toBeNull();
        });

        it('should return null when tool is not found', async () => {
            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'unknown-tool',
                [mockTool]
            );

            expect(result).toBeNull();
        });

        it('should return null when tool has no kerf width', async () => {
            const toolNoKerf = {
                ...mockTool,
                kerfWidth: undefined,
            } as unknown as Tool;

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [toolNoKerf]
            );

            expect(result).toBeNull();
        });

        it('should return null when tool has zero kerf width', async () => {
            const toolZeroKerf = { ...mockTool, kerfWidth: 0 };

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [toolZeroKerf]
            );

            expect(result).toBeNull();
        });

        it('should return null when offset calculation fails', async () => {
            vi.mocked(polylineOffset).mockResolvedValue({
                success: false,
                errors: ['Offset failed'],
                warnings: [],
            });

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
        });

        it('should return null when no appropriate offset chain is found for INSET', async () => {
            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
        });

        it('should return null when no appropriate offset chain is found for OUTSET', async () => {
            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [],
                },
                warnings: [],
                errors: [],
            });

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.OUTSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
        });

        it('should handle errors during offset calculation', async () => {
            vi.mocked(polylineOffset).mockRejectedValue(
                new Error('Calculation error')
            );

            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).toBeNull();
        });

        it('should return successful result for INSET direction', async () => {
            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.INSET,
                'tool-1',
                [mockTool]
            );

            expect(result).not.toBeNull();
            expect(result!.offsetShapes).toHaveLength(1);
            expect(result!.offsetShapes[0].id).toBe('shape-1');
            expect(result!.originalShapes).toHaveLength(1);
            expect(result!.originalShapes[0].id).toBe('shape-1');
            expect(result!.kerfWidth).toBe(2.0);
            expect(result!.warnings).toEqual(['Test warning']);
        });

        it('should return successful result for OUTSET direction', async () => {
            const result = await calculateChainOffset(
                mockChain,
                OffsetDirection.OUTSET,
                'tool-1',
                [mockTool]
            );

            expect(result).not.toBeNull();
            expect(result!.offsetShapes).toHaveLength(1);
            expect(result!.offsetShapes[0].id).toBe('shape-1');
            expect(result!.originalShapes).toHaveLength(1);
            expect(result!.originalShapes[0].id).toBe('shape-1');
            expect(result!.kerfWidth).toBe(2.0);
            expect(result!.warnings).toEqual(['Test warning']);
        });
    });

    describe('createCutChain', () => {
        it('should handle user cut direction NONE', () => {
            const result = createCutChain(
                new Chain(mockChain),
                CutDirection.NONE
            );

            expect(result.cutChain.id).toBe('chain-1-cut');
            expect(result.cutChain.shapes).toHaveLength(1);
            expect(result.executionClockwise).toBeNull();
        });

        it('should handle open chain (natural direction NONE) with CLOCKWISE user direction', () => {
            const openChain = { ...mockChainData, clockwise: null };
            const result = createCutChain(
                new Chain(openChain),
                CutDirection.CLOCKWISE
            );

            expect(result.executionClockwise).toBe(true);
        });

        it('should handle open chain (natural direction NONE) with COUNTERCLOCKWISE user direction', () => {
            const openChain = { ...mockChainData, clockwise: null };
            vi.mocked(reverseChain).mockReturnValue(
                new Chain({
                    id: 'chain-1',
                    name: 'chain-1',
                    shapes: [mockChainData.shapes[0]],
                })
            );

            const result = createCutChain(
                new Chain(openChain),
                CutDirection.COUNTERCLOCKWISE
            );

            expect(reverseChain).toHaveBeenCalled();
            expect(result.executionClockwise).toBe(false);
        });

        it('should handle closed chain with user direction opposite to natural', () => {
            const closedChain = { ...mockChainData, clockwise: true };
            vi.mocked(reverseChain).mockReturnValue(
                new Chain({
                    id: 'chain-1',
                    name: 'chain-1',
                    shapes: [new Shape(mockChain.shapes[0])],
                })
            );

            const result = createCutChain(
                new Chain(closedChain),
                CutDirection.COUNTERCLOCKWISE
            );

            expect(reverseChain).toHaveBeenCalled();
            expect(result.executionClockwise).toBe(false);
        });

        it('should handle closed chain with user direction same as natural', () => {
            const closedChain = { ...mockChainData, clockwise: true };
            const result = createCutChain(
                new Chain(closedChain),
                CutDirection.CLOCKWISE
            );

            expect(reverseChain).not.toHaveBeenCalled();
            expect(result.executionClockwise).toBe(true);
        });

        it('should use offset shapes when provided', () => {
            const offsetShapes = [
                new Shape({ ...mockChainData.shapes[0], id: 'offset-shape-1' }),
            ];
            const result = createCutChain(
                mockChain,
                CutDirection.CLOCKWISE,
                offsetShapes
            );

            expect(result.cutChain.shapes[0].id).toBe('offset-shape-1');
        });
    });

    describe('generateCutsForChainWithOperation', () => {
        it('should return empty arrays when chain not found', async () => {
            const operation = createOperation(mockOperation, mockTool, []);
            const result = await generateCutsForChainsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate cut for chain with kerf compensation INNER', async () => {
            const operationWithKerfData = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.INNER,
            };

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operationWithKerf = createOperation(
                operationWithKerfData,
                mockTool,
                [mockChain]
            );
            const result = await generateCutsForChainsWithOperation(
                operationWithKerf,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(1);
            expect(result.cuts[0].kerfCompensation).toBe(OffsetDirection.INSET);
        });

        it('should generate cut for chain with kerf compensation OUTER', async () => {
            const operationWithKerfData = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.OUTER,
            };

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operationWithKerf = createOperation(
                operationWithKerfData,
                mockTool,
                [mockChain]
            );
            const result = await generateCutsForChainsWithOperation(
                operationWithKerf,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(1);
            expect(result.cuts[0].kerfCompensation).toBe(
                OffsetDirection.OUTSET
            );
        });

        it('should generate cut for chain with kerf compensation PART (treated as NONE for chains)', async () => {
            const operationWithKerfData = {
                ...mockOperation,
                kerfCompensation: KerfCompensation.PART,
            };

            const operationWithKerf = createOperation(
                operationWithKerfData,
                mockTool,
                [mockChain]
            );
            const result = await generateCutsForChainsWithOperation(
                operationWithKerf,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(1);
            expect(result.cuts[0].kerfCompensation).toBe(OffsetDirection.NONE);
        });
    });

    describe('generateCutsForPartTargetWithOperation', () => {
        it('should return empty arrays when part not found', async () => {
            const operation = createOperation(mockOperation, mockTool, []);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate cuts for part with kerf compensation PART', async () => {
            const operationWithKerfData = {
                ...mockOperation,
                targetType: 'parts' as const,
                kerfCompensation: KerfCompensation.PART,
            };

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operationWithKerf = createOperation(
                operationWithKerfData,
                mockTool,
                [mockPart]
            );
            const result = await generateCutsForPartsWithOperation(
                operationWithKerf,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(2); // Shell + 1 hole
            expect(result.cuts[0].kerfCompensation).toBe(
                OffsetDirection.OUTSET
            ); // Shell
            expect(result.cuts[1].kerfCompensation).toBe(OffsetDirection.INSET); // Hole
        });

        it('should handle multiple holes', async () => {
            const partWithMultipleHolesData: PartData = {
                ...mockPartData,
                voids: [
                    {
                        id: 'hole-1',
                        type: PartType.HOLE,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: false,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                    },
                    {
                        id: 'hole-2',
                        type: PartType.HOLE,
                        chain: {
                            id: 'chain-3',
                            name: 'chain-3',
                            clockwise: false,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 4, y: 4 },
                            max: { x: 6, y: 6 },
                        },
                    },
                ],
                slots: [],
            };

            const partWithMultipleHoles = new Part(partWithMultipleHolesData);

            const _chains = [
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

            const operation = createOperation(mockOperation, mockTool, [
                partWithMultipleHoles,
            ]);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(3); // Shell + 2 holes
        });

        it('should generate cuts for part with slots and kerf compensation NONE', async () => {
            const partWithSlotsData: PartData = {
                ...mockPartData,
                voids: [],
                slots: [
                    {
                        id: 'slot-1',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                    },
                ],
            };
            const partWithSlots = new Part(partWithSlotsData);

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: null, // Open chain
                    shapes: [mockChain.shapes[0]],
                },
            ];

            const operation = createOperation(mockOperation, mockTool, [
                partWithSlots,
            ]);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(2); // Shell + 1 slot
            expect(result.cuts[1].name).toContain('Slot 1');
            expect(result.cuts[1].kerfCompensation).toBe(OffsetDirection.NONE);
            expect(result.cuts[1].isHole).toBe(false);
        });

        it('should generate cuts for part with slots and kerf compensation PART (should not offset slots)', async () => {
            const operationWithPartKerf = {
                ...mockOperation,
                targetType: 'parts' as const,
                kerfCompensation: KerfCompensation.PART,
            };

            const partWithSlotsData: PartData = {
                ...mockPartData,
                voids: [],
                slots: [
                    {
                        id: 'slot-1',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                    },
                ],
            };
            const partWithSlots = new Part(partWithSlotsData);

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: null, // Open chain
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operation = createOperation(operationWithPartKerf, mockTool, [
                partWithSlots,
            ]);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(2); // Shell + 1 slot
            expect(result.cuts[0].kerfCompensation).toBe(
                OffsetDirection.OUTSET
            ); // Shell should be offset
            expect(result.cuts[1].kerfCompensation).toBe(OffsetDirection.NONE); // Slot should NOT be offset
            expect(result.cuts[1].isHole).toBe(false);
        });

        it('should generate cuts for part with slots and kerf compensation INNER', async () => {
            const operationWithInnerKerf = {
                ...mockOperation,
                targetType: 'parts' as const,
                kerfCompensation: KerfCompensation.INNER,
            };

            const partWithSlotsData: PartData = {
                ...mockPartData,
                voids: [],
                slots: [
                    {
                        id: 'slot-1',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 8, y: 8 },
                        },
                    },
                ],
            };
            const partWithSlots = new Part(partWithSlotsData);

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: null, // Open chain
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-2',
                    side: 'inner',
                    closed: false,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-2',
                    side: 'outer',
                    closed: false,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operation = createOperation(
                operationWithInnerKerf,
                mockTool,
                [partWithSlots]
            );
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(2); // Shell + 1 slot
            expect(result.cuts[1].kerfCompensation).toBe(OffsetDirection.INSET); // Slot should respect INNER
        });

        it('should generate cuts for part with multiple slots', async () => {
            const partWithMultipleSlotsData: PartData = {
                ...mockPartData,
                voids: [],
                slots: [
                    {
                        id: 'slot-1',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 4, y: 4 },
                        },
                    },
                    {
                        id: 'slot-2',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-3',
                            name: 'chain-3',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 6, y: 6 },
                            max: { x: 8, y: 8 },
                        },
                    },
                ],
            };
            const partWithMultipleSlots = new Part(partWithMultipleSlotsData);

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: null,
                    shapes: [mockChain.shapes[0]],
                },
                {
                    id: 'chain-3',
                    clockwise: null,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            const operation = createOperation(mockOperation, mockTool, [
                partWithMultipleSlots,
            ]);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(3); // Shell + 2 slots
            expect(result.cuts[1].name).toContain('Slot 1');
            expect(result.cuts[2].name).toContain('Slot 2');
        });

        it('should generate cuts for part with voids and slots in correct order', async () => {
            const partWithVoidsAndSlotsData: PartData = {
                ...mockPartData,
                voids: [
                    {
                        id: 'hole-1',
                        type: PartType.HOLE,
                        chain: {
                            id: 'chain-2',
                            name: 'chain-2',
                            clockwise: false,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 2, y: 2 },
                            max: { x: 4, y: 4 },
                        },
                    },
                ],
                slots: [
                    {
                        id: 'slot-1',
                        type: PartType.SLOT,
                        chain: {
                            id: 'chain-3',
                            name: 'chain-3',
                            clockwise: null,
                            shapes: [],
                        },
                        boundingBox: {
                            min: { x: 6, y: 6 },
                            max: { x: 8, y: 8 },
                        },
                    },
                ],
            };
            const partWithVoidsAndSlots = new Part(partWithVoidsAndSlotsData);

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
                {
                    id: 'chain-3',
                    clockwise: null,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            const operation = createOperation(mockOperation, mockTool, [
                partWithVoidsAndSlots,
            ]);
            const result = await generateCutsForPartsWithOperation(
                operation,
                0,
                0.01
            );

            expect(result.cuts).toHaveLength(3); // Shell + 1 void + 1 slot
            expect(result.cuts[0].name).toContain('Shell');
            expect(result.cuts[1].name).toContain('Hole 1');
            expect(result.cuts[2].name).toContain('Slot 1');
            expect(result.cuts[1].isHole).toBe(true);
            expect(result.cuts[2].isHole).toBe(false);
        });
    });

    describe('calculateCutLeads', () => {
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
            const cutNoLeads = {
                ...mockCut,
                leadInConfig: { type: LeadType.NONE, length: 0 },
                leadOutConfig: { type: LeadType.NONE, length: 0 },
            };

            const result = await calculateCutLeads(
                new Cut(cutNoLeads),
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result).toEqual({});
        });

        it('should calculate leads with offset geometry when available', async () => {
            const cutWithOffset = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            ...mockChainData.shapes[0],
                            id: 'offset-shape',
                        }),
                    ],
                    originalShapes: mockChainData.shapes.map(
                        (s) => new Shape(s)
                    ),
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

            const result = await calculateCutLeads(
                new Cut(cutWithOffset),
                operationParts,
                mockChain,
                [mockPart]
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.any(Chain), // Chain instance with offset geometry
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
                mockCut.cutDirection,
                mockPart,
                expect.any(Object) // cutNormal
            );

            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();
        });

        it('should handle empty offset shapes by using original chain', async () => {
            const cutWithEmptyOffset = {
                ...mockCut,
                calculatedOffset: {
                    offsetShapes: [],
                    originalShapes: mockChainData.shapes,
                    direction: OffsetDirection.INSET,
                    kerfWidth: 2.0,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            };

            const result = await calculateCutLeads(
                new Cut(cutWithEmptyOffset),
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.any(Chain),
                expect.anything(),
                expect.anything(),
                mockCut.cutDirection,
                undefined,
                expect.any(Object) // cutNormal
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

            const result = await calculateCutLeads(
                new Cut(mockCut),
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

            const result = await calculateCutLeads(
                new Cut(mockCut),
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

            const result = await calculateCutLeads(
                new Cut(mockCut),
                mockOperation,
                mockChain,
                [mockPart]
            );

            expect(result.validation?.isValid).toBe(false);
            expect(result.validation?.errors).toEqual(['Unknown error']);
        });
    });

    describe('calculateOperationLeads', () => {
        it('should calculate leads for all cuts in operation', async () => {
            const cuts = [
                mockCut,
                { ...mockCut, id: 'cut-2', chainId: 'chain-2' },
            ];
            const _chains = [
                mockChain,
                new Chain({ ...mockChainData, id: 'chain-2' }),
            ];

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
                cuts.map((c) => new Cut(c)),
                _chains,
                [mockPart]
            );

            expect(result.size).toBe(2);
            expect(result.has('cut-1')).toBe(true);
            expect(result.has('cut-2')).toBe(true);
        });

        it('should handle errors during calculation', async () => {
            vi.mocked(calculateLeads).mockImplementation(() => {
                throw new Error('Calculation error');
            });

            const result = await calculateOperationLeads(
                mockOperation,
                [new Cut(mockCut)],
                [mockChain],
                [mockPart]
            );

            // Should return a result even when calculation fails
            expect(result).toBeInstanceOf(Map);
        });
    });

    describe('createCutsFromOperation', () => {
        it('should return empty arrays when operation is disabled', async () => {
            const disabledOperationData = { ...mockOperation, enabled: false };

            const disabledOperation = createOperation(
                disabledOperationData,
                mockTool,
                [mockChain]
            );
            const result = await createCutsFromOperation(
                disabledOperation,
                0.01
            );

            expect(result.cuts).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should return empty arrays when operation has no target IDs', async () => {
            const operationNoTargetsData = { ...mockOperation, targetIds: [] };

            const operationNoTargets = createOperation(
                operationNoTargetsData,
                mockTool,
                []
            );
            const result = await createCutsFromOperation(
                operationNoTargets,
                0.01
            );

            expect(result.cuts).toEqual([]);
            expect(result.warnings).toEqual([]);
        });

        it('should generate cuts for chain targets', async () => {
            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operation = createOperation(mockOperation, mockTool, [
                mockChain,
            ]);
            const result = await createCutsFromOperation(operation, 0.01);

            expect(result.cuts).toHaveLength(1);
            expect(result.warnings).toHaveLength(0);
        });

        it('should generate cuts for part targets', async () => {
            const operationParts = {
                ...mockOperation,
                targetType: 'parts' as const,
                targetIds: ['part-1'],
            };

            const _chains = [
                mockChain,
                {
                    id: 'chain-2',
                    clockwise: false,
                    shapes: [mockChain.shapes[0]],
                },
            ];

            vi.mocked(polylineOffset).mockResolvedValue({
                success: true,
                innerChain: {
                    id: 'inner-chain',
                    name: 'inner-chain',
                    originalChainId: 'chain-1',
                    side: 'inner',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                outerChain: {
                    id: 'outer-chain',
                    name: 'outer-chain',
                    originalChainId: 'chain-1',
                    side: 'outer',
                    closed: true,
                    continuous: true,
                    shapes: [mockChain.shapes[0]],
                },
                warnings: [],
                errors: [],
            });

            const operation = createOperation(operationParts, mockTool, [
                mockPart,
            ]);
            const result = await createCutsFromOperation(operation, 0.01);

            expect(result.cuts).toHaveLength(2); // Shell + 1 hole
        });
    });
});
