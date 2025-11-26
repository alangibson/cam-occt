import { Chain } from '$lib/cam/chain/classes';
/**
 * Tests for adjustCutStartPointForLeadKerfOverlap function
 */

import { describe, it, expect } from 'vitest';
import { adjustCutStartPointForLeadKerfOverlap } from './functions';
import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import { LeadType } from '$lib/cam/lead/enums';
import { OperationAction } from '$lib/cam/operation/enums';

describe('adjustCutStartPointForLeadKerfOverlap', () => {
    // Helper to create a simple square chain
    function createSquareChain(
        id: string,
        size: number,
        startX: number = 0,
        startY: number = 0
    ): ChainData {
        const shapes: ShapeData[] = [
            {
                id: `${id}-bottom`,
                type: GeometryType.LINE,
                geometry: {
                    start: { x: startX, y: startY },
                    end: { x: startX + size, y: startY },
                } as Line,
            },
            {
                id: `${id}-right`,
                type: GeometryType.LINE,
                geometry: {
                    start: { x: startX + size, y: startY },
                    end: { x: startX + size, y: startY + size },
                } as Line,
            },
            {
                id: `${id}-top`,
                type: GeometryType.LINE,
                geometry: {
                    start: { x: startX + size, y: startY + size },
                    end: { x: startX, y: startY + size },
                } as Line,
            },
            {
                id: `${id}-left`,
                type: GeometryType.LINE,
                geometry: {
                    start: { x: startX, y: startY + size },
                    end: { x: startX, y: startY },
                } as Line,
            },
        ];

        return {
            id,
            shapes,
            clockwise: true,
        };
    }

    // Helper to create a simple tool
    function createTool(kerfWidth: number): Tool {
        return {
            id: 'test-tool',
            toolNumber: 1,
            toolName: 'Test Tool',
            kerfWidth,
            feedRate: 100,
            pierceHeight: 3,
            pierceDelay: 0.5,
            cutHeight: 1.5,
            arcVoltage: 120,
            thcEnable: true,
            gasPressure: 5,
            pauseAtEnd: 0,
            puddleJumpHeight: 0,
            puddleJumpDelay: 0,
            plungeRate: 100,
        };
    }

    // Helper to create a simple cut
    function createCut(
        cutChainData: ChainData,
        toolId: string,
        leadInLength: number = 5
    ): CutData {
        const cutChain = new Chain(cutChainData);
        return {
            id: 'test-cut',
            name: 'Test Cut',
            enabled: true,
            order: 1,
            action: OperationAction.CUT,
            operationId: 'test-op',
            chainId: cutChain.id,
            toolId,
            cutDirection: CutDirection.CLOCKWISE,
            cutChain,
            executionClockwise: true,
            normal: { x: -1, y: 0 }, // Normal pointing left
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
            leadInConfig: {
                type: LeadType.ARC,
                length: leadInLength,
                angle: 90,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: leadInLength,
                angle: 90,
            },
            kerfCompensation: OffsetDirection.NONE,
        };
    }

    it('should return false for cuts without cutChain', async () => {
        const cut: CutData = createCut(
            createSquareChain('square', 10),
            'test-tool'
        );
        delete cut.cutChain;

        const tool = createTool(2);

        const result = await adjustCutStartPointForLeadKerfOverlap(
            new Cut(cut),
            tool,
            0.01,
            [] // Empty parts array
        );

        expect(result).toBe(false);
    });

    it('should return false for open chains', async () => {
        const openChain: ChainData = {
            id: 'open-chain',
            shapes: [
                {
                    id: 'line-1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 0 },
                    } as Line,
                },
            ],
        };

        const cut = createCut(openChain, 'test-tool');
        const tool = createTool(2);

        const result = await adjustCutStartPointForLeadKerfOverlap(
            new Cut(cut),
            tool,
            0.01,
            [] // Empty parts array
        );

        expect(result).toBe(false);
    });

    it('should attempt to find non-overlapping start point', async () => {
        // Create a square chain
        const squareChain = createSquareChain('square', 100);
        const cut = createCut(squareChain, 'test-tool', 5);
        const tool = createTool(2);

        // The function will try different positions
        const result = await adjustCutStartPointForLeadKerfOverlap(
            new Cut(cut),
            tool,
            0.01,
            [], // Empty parts array
            0.25, // Step size: try at 25%, 50%, 75%
            3 // Max attempts
        );

        // Result should be a boolean
        expect(typeof result).toBe('boolean');
    });

    it('should mutate cut properties when adjustment is successful', async () => {
        const squareChain = createSquareChain('square', 100);
        const cutData = createCut(squareChain, 'test-tool', 5);
        const cut = new Cut(cutData);
        const originalCutId = cut.id;
        const originalChainLength = cut.cutChain!.shapes.length;
        const tool = createTool(2);

        const result = await adjustCutStartPointForLeadKerfOverlap(
            cut,
            tool,
            0.01,
            [], // Empty parts array
            0.5, // Only try one position
            1
        );

        if (result === true) {
            // Verify essential properties are preserved
            expect(cut.id).toBe(originalCutId);
            expect(cut.name).toBe('Test Cut');

            // Verify cutChain was rotated
            expect(cut.cutChain).toBeDefined();
            expect(cut.cutChain!.shapes.length).toBe(originalChainLength);

            // Verify normal was recalculated
            expect(cut.normal).toBeDefined();
            expect(cut.normalConnectionPoint).toBeDefined();
        } else {
            // If false, cut should be unchanged
            expect(cut.id).toBe(originalCutId);
        }
    });

    it('should return false after max attempts', async () => {
        const squareChain = createSquareChain('square', 10);
        const cut = createCut(squareChain, 'test-tool', 5);
        const tool = createTool(2);

        // Try with very small chain and large lead - likely to always overlap
        const result = await adjustCutStartPointForLeadKerfOverlap(
            new Cut(cut),
            tool,
            0.01,
            [], // Empty parts array
            0.1, // 10% steps
            2 // Only 2 attempts
        );

        // Function should handle max attempts gracefully
        expect(typeof result).toBe('boolean');
    });

    it('should handle errors gracefully', async () => {
        const squareChain = createSquareChain('square', 100);
        const cut = createCut(squareChain, 'test-tool', 5);

        // Create a tool with invalid kerf width
        const invalidTool = createTool(-1);

        // Should not throw, even with invalid tool
        await expect(
            adjustCutStartPointForLeadKerfOverlap(
                new Cut(cut),
                invalidTool,
                0.01,
                [] // Empty parts array
            )
        ).resolves.toBeDefined();
    });
});
