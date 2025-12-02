import { describe, expect, it } from 'vitest';
import { generateSpotsForChainsWithOperation } from './spot-operations';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import { OperationAction } from '$lib/cam/operation/enums';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';

// Helper function to create Operation with resolved references
function createOperation(
    data: OperationData,
    tool: Tool | null,
    targets: ChainData[]
): Operation {
    const operation = new Operation(data);
    operation.setTool(tool);
    operation.setTargets(targets);
    return operation;
}

describe('generateSpotsForChainsWithOperation', () => {
    const mockChain: ChainData = {
        id: 'chain-1',
        name: 'chain-1',
        clockwise: true,
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.CIRCLE,
                layer: 'layer-1',
                geometry: { center: { x: 50, y: 50 }, radius: 25 },
            } as any,
        ],
    };

    const mockTool: Tool = {
        id: 'tool-1',
        toolNumber: 1,
        toolName: 'Spot Tool',
        kerfWidth: 0,
        feedRate: 1000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        cutHeight: 1.5,
        arcVoltage: 120,
        kerfWidthMetric: 0,
        kerfWidthImperial: 0,
    } as any;

    const mockSpotOperation: OperationData = {
        id: 'op-1',
        name: 'Spot Operation',
        action: OperationAction.SPOT,
        enabled: true,
        toolId: 'tool-1',
        targetType: 'chains',
        targetIds: ['chain-1'],
        order: 0,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: { type: LeadType.NONE, length: 0 },
        leadOutConfig: { type: LeadType.NONE, length: 0 },
        spotDuration: 100,
    };

    it('should create spot cut with action field set to SPOT', async () => {
        const operation = createOperation(mockSpotOperation, mockTool, [
            mockChain,
        ]);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        expect(result.cuts).toHaveLength(1);
        expect(result.cuts[0].action).toBe(OperationAction.SPOT);
    });

    it('should preserve spotDuration from operation to cut', async () => {
        const operation = createOperation(mockSpotOperation, mockTool, [
            mockChain,
        ]);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        expect(result.cuts[0].spotDuration).toBe(100);
    });

    it('should create cut at chain centroid', async () => {
        const operation = createOperation(mockSpotOperation, mockTool, [
            mockChain,
        ]);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        const cut = result.cuts[0];
        expect(cut.cutChain).toBeDefined();
        expect(cut.cutChain!.shapes).toHaveLength(1);
        expect(cut.cutChain!.shapes[0].type).toBe(GeometryType.POINT);
    });

    it('should set cut name with (Spot) suffix', async () => {
        const operation = createOperation(mockSpotOperation, mockTool, [
            mockChain,
        ]);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        expect(result.cuts[0].name).toContain('Spot');
    });

    it('should return empty result when chain is missing', async () => {
        const operation = createOperation(mockSpotOperation, mockTool, []);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        expect(result.cuts).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });

    it('should return empty result when tool is missing', async () => {
        const operation = createOperation(mockSpotOperation, null, [mockChain]);

        const result = await generateSpotsForChainsWithOperation(operation, 0);

        expect(result.cuts).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
    });

    it('should handle multiple chains', async () => {
        const mockChain2: ChainData = {
            id: 'chain-2',
            name: 'chain-2',
            clockwise: false,
            shapes: [
                {
                    id: 'shape-2',
                    type: GeometryType.CIRCLE,
                    layer: 'layer-1',
                    geometry: { center: { x: 100, y: 100 }, radius: 30 },
                } as any,
            ],
        };

        const multiChainOp: OperationData = {
            ...mockSpotOperation,
            targetIds: ['chain-1', 'chain-2'],
        };

        const operation = createOperation(multiChainOp, mockTool, [
            mockChain,
            mockChain2,
        ]);

        // Test first chain
        const result1 = await generateSpotsForChainsWithOperation(operation, 0);
        expect(result1.cuts).toHaveLength(1);
        expect(result1.cuts[0].action).toBe(OperationAction.SPOT);

        // Test second chain
        const result2 = await generateSpotsForChainsWithOperation(operation, 1);
        expect(result2.cuts).toHaveLength(1);
        expect(result2.cuts[0].action).toBe(OperationAction.SPOT);
    });
});
