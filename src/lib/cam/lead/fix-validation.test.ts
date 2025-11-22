import { describe, expect, it } from 'vitest';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import { Chain } from '$lib/geometry/chain/classes';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from './enums';
import { calculateLeads } from './lead-calculation';
import type { LeadConfig } from './interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { Shape } from '$lib/geometry/shape/classes';
import type { Line } from '$lib/geometry/line/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { prepareChainsAndLeadConfigs } from '$lib/cam/cut/cut-optimization-utils';
import { OffsetDirection } from '$lib/cam/offset/types';

/**
 * Test to validate that the clockwise property fix works in the actual code cuts
 */
describe('Clockwise Property Fix Validation', () => {
    const baseLeadConfig: LeadConfig = {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: false,
    };

    // Helper to create a closed rectangular chain
    function createClosedRectangleChain(clockwise?: boolean): ChainData {
        const shapes: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 0 },
                    end: { x: 10, y: 0 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 0 },
                    end: { x: 10, y: 10 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 0, y: 10 },
                } as Line,
                layer: 'layer1',
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 0, y: 10 },
                    end: { x: 0, y: 0 },
                } as Line,
                layer: 'layer1',
            },
        ];

        return {
            id: 'rectangle-chain',
            shapes,
            clockwise,
        };
    }

    // Helper to create a cut with offset data
    function createCutWithOffset(
        originalChain: ChainData,
        offsetShapes: ShapeData[]
    ): Cut {
        return new Cut({
            id: 'test-cut',
            name: 'Test Cut',
            operationId: 'test-operation',
            chainId: originalChain.id,
            toolId: 'test-tool',
            enabled: true,
            order: 1,
            leadInConfig: baseLeadConfig,
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            cutDirection: CutDirection.CLOCKWISE,
            normal: { x: 1, y: 0 },
            normalConnectionPoint: { x: 0, y: 0 },
            normalSide: NormalSide.LEFT,
            offset: {
                offsetShapes: offsetShapes.map((s) => new Shape(s)),
                originalShapes: originalChain.shapes.map((s) => new Shape(s)),
                direction: OffsetDirection.INSET,
                kerfWidth: 1,
                generatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        });
    }

    describe('prepareChainsAndLeadConfigs fix validation', () => {
        it('should preserve clockwise property when creating offset chain for lead calculation', () => {
            // Create original chain with clockwise = false
            const originalChain = createClosedRectangleChain(false);

            // Create some offset shapes (content doesn't matter for this test)
            const offsetShapes: ShapeData[] = [
                {
                    id: 'offset-line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 1 },
                        end: { x: 9, y: 1 },
                    } as Line,
                    layer: 'layer1',
                },
            ];

            // Create cut with offset data
            const cut = createCutWithOffset(originalChain, offsetShapes);

            // Use the fixed prepareChainsAndLeadConfigs function
            const result = prepareChainsAndLeadConfigs(
                cut,
                new Chain(originalChain)
            );

            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log(
                'Lead calculation chain clockwise:',
                result.leadCalculationChain.clockwise
            );

            // The lead calculation chain should preserve the clockwise property
            expect(result.leadCalculationChain.clockwise).toBe(
                originalChain.clockwise
            );
            expect(result.leadCalculationChain.clockwise).toBe(false);

            // Verify that the shapes are from the offset (compare IDs since Shape[] != ShapeData[])
            expect(result.leadCalculationChain.shapes.map((s) => s.id)).toEqual(
                offsetShapes.map((s) => s.id)
            );
            expect(result.leadCalculationChain.id).toBe(
                'rectangle-chain_offset_temp'
            );
        });

        it('should preserve clockwise=true property', () => {
            const originalChain = createClosedRectangleChain(true);
            const offsetShapes: ShapeData[] = [
                {
                    id: 'offset-line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 1 },
                        end: { x: 9, y: 1 },
                    } as Line,
                    layer: 'layer1',
                },
            ];

            const cut = createCutWithOffset(originalChain, offsetShapes);
            const result = prepareChainsAndLeadConfigs(
                cut,
                new Chain(originalChain)
            );

            expect(result.leadCalculationChain.clockwise).toBe(true);
        });

        it('should preserve clockwise=undefined property', () => {
            const originalChain = createClosedRectangleChain(undefined);
            const offsetShapes: ShapeData[] = [
                {
                    id: 'offset-line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 1 },
                        end: { x: 9, y: 1 },
                    } as Line,
                    layer: 'layer1',
                },
            ];

            const cut = createCutWithOffset(originalChain, offsetShapes);
            const result = prepareChainsAndLeadConfigs(
                cut,
                new Chain(originalChain)
            );

            expect(result.leadCalculationChain.clockwise).toBeUndefined();
        });
    });

    describe('Lead calculation consistency with fix', () => {
        it('should produce consistent normal directions between original and offset chains after fix', () => {
            // Create original chain with clockwise = false
            const originalChain = createClosedRectangleChain(false);

            // Create offset shapes (simulate inward offset)
            const offsetShapes: ShapeData[] = [
                {
                    id: 'offset-line1',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 1 },
                        end: { x: 9, y: 1 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'offset-line2',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 9, y: 1 },
                        end: { x: 9, y: 9 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'offset-line3',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 9, y: 9 },
                        end: { x: 1, y: 9 },
                    } as Line,
                    layer: 'layer1',
                },
                {
                    id: 'offset-line4',
                    type: GeometryType.LINE,
                    geometry: {
                        start: { x: 1, y: 9 },
                        end: { x: 1, y: 1 },
                    } as Line,
                    layer: 'layer1',
                },
            ];

            // Calculate leads on original chain
            const originalResult = calculateLeads(
                new Chain(originalChain),
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            // Create cut with offset and use the fixed function
            const cut = createCutWithOffset(originalChain, offsetShapes);
            const { leadCalculationChain } = prepareChainsAndLeadConfigs(
                cut,
                new Chain(originalChain)
            );

            // Calculate leads on the fixed offset chain
            const offsetResult = calculateLeads(
                leadCalculationChain,
                baseLeadConfig,
                { type: LeadType.NONE, length: 0 },
                CutDirection.CLOCKWISE,
                undefined,
                { x: 1, y: 0 }
            );

            console.log('Original chain clockwise:', originalChain.clockwise);
            console.log(
                'Fixed offset chain clockwise:',
                leadCalculationChain.clockwise
            );
            console.log('Original normal:', originalResult.leadIn?.normal);
            console.log('Offset normal:', offsetResult.leadIn?.normal);

            // Now these should be consistent!
            if (
                originalResult.leadIn &&
                offsetResult.leadIn &&
                originalResult.leadIn.normal &&
                offsetResult.leadIn.normal
            ) {
                expect(originalResult.leadIn.normal.x).toBeCloseTo(
                    offsetResult.leadIn.normal.x,
                    6
                );
                expect(originalResult.leadIn.normal.y).toBeCloseTo(
                    offsetResult.leadIn.normal.y,
                    6
                );
                console.log('✓ Normal directions now match after fix!');
            }
        });
    });
});
