import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCutsFromOperation } from './cut-generation';
import { generateCutsForChainsWithOperation } from './chain-operations';
import { generateCutsForPartsWithOperation } from './part-operations';
import { generateAndAdjustKerf } from '$lib/cam/pipeline/kerfs/kerf-generation';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { Operation } from '$lib/cam/operation/interface';
import type { PartData } from '$lib/cam/part/interfaces';
import { Part } from '$lib/cam/part/classes.svelte';
import { GeometryType } from '$lib/geometry/shape/enums';
import { KerfCompensation } from '$lib/cam/operation/enums';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { PartType } from '$lib/cam/part/enums';

// Mock dependencies
vi.mock('./chain-operations', () => ({
    generateCutsForChainsWithOperation: vi.fn(),
}));

vi.mock('./part-operations', () => ({
    generateCutsForPartsWithOperation: vi.fn(),
}));

vi.mock('$lib/cam/pipeline/kerfs/kerf-generation', () => ({
    generateAndAdjustKerf: vi.fn(),
}));

describe('createCutsFromOperation', () => {
    const mockChain: Chain = {
        id: 'chain-1',
        clockwise: true,
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
            } as any,
        ],
    };

    const mockTool: Tool = {
        id: 'tool-1',
        toolNumber: 1,
        toolName: 'Test Tool',
        kerfWidth: 2.0,
        feedRate: 100,
        pierceHeight: 4.0,
        pierceDelay: 0.5,
        cutHeight: 2.0,
        arcVoltage: 120,
        minArcTime: 0.1,
        cutAmps: 45,
        kerfWidthMetric: 2.0,
        kerfWidthImperial: 0.079,
    } as any;

    const mockOperation: Operation = {
        id: 'op-1',
        name: 'Test Operation',
        enabled: true,
        toolId: 'tool-1',
        targetType: 'chains',
        targetIds: ['chain-1'],
        order: 0,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: { type: LeadType.ARC, length: 5.0 },
        leadOutConfig: { type: LeadType.ARC, length: 5.0 },
        kerfCompensation: KerfCompensation.OUTER,
    };

    const tolerance = 0.01;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return empty result for disabled operation', async () => {
        const disabledOp: Operation = { ...mockOperation, enabled: false };

        const result = await createCutsFromOperation(
            disabledOp,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(generateCutsForChainsWithOperation).not.toHaveBeenCalled();
    });

    it('should return empty result for operation with no targets', async () => {
        const noTargetsOp: Operation = { ...mockOperation, targetIds: [] };

        const result = await createCutsFromOperation(
            noTargetsOp,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(generateCutsForChainsWithOperation).not.toHaveBeenCalled();
    });

    it('should generate cuts for chain operation', async () => {
        const mockCut = {
            id: 'cut-1',
            name: 'Test Cut',
            chainId: 'chain-1',
        } as any;

        vi.mocked(generateCutsForChainsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        const result = await createCutsFromOperation(
            mockOperation,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(result.cuts[0]).toBe(mockCut);
        expect(generateCutsForChainsWithOperation).toHaveBeenCalledWith(
            mockOperation,
            'chain-1',
            0,
            [mockChain],
            [mockTool],
            [],
            tolerance
        );
    });

    it('should generate cuts for part operation', async () => {
        const partOp: Operation = {
            ...mockOperation,
            targetType: 'parts',
            targetIds: ['part-1'],
        };
        const mockPartData: PartData = {
            id: 'part-1',
            type: PartType.SHELL,
            shell: mockChain,
            voids: [],
            slots: [],
        } as any;
        const mockPart = new Part(mockPartData);

        const mockCut = {
            id: 'cut-1',
            name: 'Part Cut',
            chainId: 'chain-1',
        } as any;

        vi.mocked(generateCutsForPartsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        const result = await createCutsFromOperation(
            partOp,
            [mockChain],
            [mockPart],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(result.cuts[0]).toBe(mockCut);
        expect(generateCutsForPartsWithOperation).toHaveBeenCalledWith(
            partOp,
            'part-1',
            0,
            [mockChain],
            [mockPart],
            [mockTool],
            tolerance
        );
    });

    it('should generate cuts for multiple targets', async () => {
        const multiTargetOp: Operation = {
            ...mockOperation,
            targetIds: ['chain-1', 'chain-2'],
        };

        const mockChain2: Chain = {
            id: 'chain-2',
            clockwise: false,
            shapes: [
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 50, y: 0 } },
                } as any,
            ],
        };

        const mockCut1 = {
            id: 'cut-1',
            name: 'Cut 1',
            chainId: 'chain-1',
        } as any;

        const mockCut2 = {
            id: 'cut-2',
            name: 'Cut 2',
            chainId: 'chain-2',
        } as any;

        vi.mocked(generateCutsForChainsWithOperation)
            .mockResolvedValueOnce({
                cuts: [mockCut1],
                warnings: [],
            })
            .mockResolvedValueOnce({
                cuts: [mockCut2],
                warnings: [],
            });

        const result = await createCutsFromOperation(
            multiTargetOp,
            [mockChain, mockChain2],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(2);
        expect(result.cuts[0]).toBe(mockCut1);
        expect(result.cuts[1]).toBe(mockCut2);
        expect(generateCutsForChainsWithOperation).toHaveBeenCalledTimes(2);
    });

    it('should aggregate warnings from multiple targets', async () => {
        const multiTargetOp: Operation = {
            ...mockOperation,
            targetIds: ['chain-1', 'chain-2'],
        };

        vi.mocked(generateCutsForChainsWithOperation)
            .mockResolvedValueOnce({
                cuts: [],
                warnings: [
                    {
                        chainId: 'chain-1',
                        operationId: 'op-1',
                        offsetWarnings: ['Warning 1'],
                        clearExistingWarnings: false,
                    },
                ],
            })
            .mockResolvedValueOnce({
                cuts: [],
                warnings: [
                    {
                        chainId: 'chain-2',
                        operationId: 'op-1',
                        offsetWarnings: ['Warning 2'],
                        clearExistingWarnings: false,
                    },
                ],
            });

        const result = await createCutsFromOperation(
            multiTargetOp,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.warnings).toHaveLength(2);
        expect(result.warnings[0].offsetWarnings[0]).toBe('Warning 1');
        expect(result.warnings[1].offsetWarnings[0]).toBe('Warning 2');
    });

    it('should generate kerfs when tool has kerf width', async () => {
        const mockCut = {
            id: 'cut-1',
            name: 'Test Cut',
            chainId: 'chain-1',
            offset: {
                originalShapes: mockChain.shapes,
                offsetShapes: mockChain.shapes,
            },
        } as any;

        vi.mocked(generateCutsForChainsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        vi.mocked(generateAndAdjustKerf).mockResolvedValue({} as any);

        const result = await createCutsFromOperation(
            mockOperation,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(generateAndAdjustKerf).toHaveBeenCalledWith(
            mockCut,
            mockTool,
            expect.objectContaining({
                id: 'chain-1',
                shapes: mockChain.shapes,
            }),
            tolerance,
            []
        );
    });

    it('should not generate kerfs when tool has zero kerf width', async () => {
        const noKerfTool: Tool = { ...mockTool, kerfWidth: 0 };
        const mockCut = {
            id: 'cut-1',
            name: 'Test Cut',
            chainId: 'chain-1',
        } as any;

        vi.mocked(generateCutsForChainsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        const result = await createCutsFromOperation(
            mockOperation,
            [mockChain],
            [],
            [noKerfTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(generateAndAdjustKerf).not.toHaveBeenCalled();
    });

    it('should handle kerf generation errors gracefully', async () => {
        const mockCut = {
            id: 'cut-1',
            name: 'Test Cut',
            chainId: 'chain-1',
        } as any;

        vi.mocked(generateCutsForChainsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        vi.mocked(generateAndAdjustKerf).mockRejectedValue(
            new Error('Kerf generation failed')
        );

        const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        const result = await createCutsFromOperation(
            mockOperation,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Failed to generate kerf for cut:',
            expect.any(Error)
        );

        consoleWarnSpy.mockRestore();
    });

    it('should handle unknown target types', async () => {
        const unknownTargetOp: Operation = {
            ...mockOperation,
            targetType: 'unknown' as any,
            targetIds: ['unknown-1'],
        };

        const result = await createCutsFromOperation(
            unknownTargetOp,
            [mockChain],
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(generateCutsForChainsWithOperation).not.toHaveBeenCalled();
        expect(generateCutsForPartsWithOperation).not.toHaveBeenCalled();
    });

    it('should warn when chain not found for kerf generation', async () => {
        const mockCut = {
            id: 'cut-1',
            name: 'Test Cut',
            chainId: 'missing-chain',
        } as any;

        vi.mocked(generateCutsForChainsWithOperation).mockResolvedValue({
            cuts: [mockCut],
            warnings: [],
        });

        const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});

        const result = await createCutsFromOperation(
            mockOperation,
            [mockChain], // Does not include 'missing-chain'
            [],
            [mockTool],
            tolerance
        );

        expect(result.cuts).toHaveLength(1);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Cannot find chain missing-chain for cut Test Cut - skipping kerf generation'
        );
        expect(generateAndAdjustKerf).not.toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
    });
});
