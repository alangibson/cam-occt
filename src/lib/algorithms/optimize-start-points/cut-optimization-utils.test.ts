import { describe, expect, it } from 'vitest';
import {
    prepareChainsAndLeadConfigs,
    getCutStartPoint,
} from './cut-optimization-utils';
import type { Cut } from '$lib/stores/cuts/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Line, Point2D, Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { NormalSide } from '$lib/types/cam';

// Test data setup
const createTestCut = (overrides: Partial<Cut> = {}): Cut => ({
    id: 'test-cut',
    name: 'Test Cut',
    operationId: 'test-operation',
    chainId: 'test-chain',
    toolId: 'test-tool',
    enabled: true,
    order: 1,
    leadInConfig: {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: true,
    },
    leadOutConfig: {
        type: LeadType.ARC,
        length: 5,
        flipSide: false,
        fit: true,
    },
    cutDirection: CutDirection.CLOCKWISE,
    normal: { x: 1, y: 0 },
    normalConnectionPoint: { x: 0, y: 0 },
    normalSide: NormalSide.LEFT,
    ...overrides,
});

const createTestChain = (overrides: Partial<Chain> = {}): Chain => ({
    id: 'test-chain',
    shapes: [
        {
            id: 'line1',
            type: GeometryType.LINE,
            geometry: {
                start: { x: 0, y: 0 },
                end: { x: 10, y: 0 },
            } as Line,
        },
    ],
    ...overrides,
});

const createTestShape = (start: Point2D, end: Point2D): Shape => ({
    id: 'test-line',
    type: GeometryType.LINE,
    geometry: {
        start,
        end,
    } as Line,
});

describe('cut-optimization-utils', () => {
    describe('prepareChainsAndLeadConfigs', () => {
        it('should use original chain when no offset shapes available', () => {
            const cut = createTestCut();
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(cut, chain);

            expect(result.leadCalculationChain).toBe(chain);
            expect(result.leadCalculationChain.id).toBe('test-chain');
        });

        it('should create offset chain when offset shapes available', () => {
            const offsetShapes: Shape[] = [
                createTestShape({ x: 1, y: 1 }, { x: 11, y: 1 }),
            ];

            const cut = createTestCut({
                offset: {
                    offsetShapes,
                    originalShapes: [],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 1,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(cut, chain);

            expect(result.leadCalculationChain.id).toBe(
                'test-chain_offset_temp'
            );
            expect(result.leadCalculationChain.shapes).toBe(offsetShapes);
        });

        it('should create correct lead-in config', () => {
            const cut = createTestCut({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 10,
                    flipSide: true,
                    angle: 45,
                    fit: true,
                },
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(cut, chain);

            expect(result.leadInConfig.type).toBe(LeadType.ARC);
            expect(result.leadInConfig.length).toBe(10);
            expect(result.leadInConfig.flipSide).toBe(true);
            expect(result.leadInConfig.angle).toBe(45);
        });

        it('should create correct lead-out config', () => {
            const cut = createTestCut({
                leadOutConfig: {
                    type: LeadType.ARC,
                    length: 15,
                    flipSide: false,
                    angle: 90,
                    fit: true,
                },
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(cut, chain);

            expect(result.leadOutConfig.type).toBe(LeadType.ARC);
            expect(result.leadOutConfig.length).toBe(15);
            expect(result.leadOutConfig.flipSide).toBe(false);
            expect(result.leadOutConfig.angle).toBe(90);
        });

        it('should handle missing lead config values with defaults', () => {
            const cut = createTestCut({
                leadInConfig: undefined,
                leadOutConfig: undefined,
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(cut, chain);

            expect(result.leadInConfig.type).toBe(LeadType.NONE);
            expect(result.leadInConfig.length).toBe(0);
            expect(result.leadOutConfig.type).toBe(LeadType.NONE);
            expect(result.leadOutConfig.length).toBe(0);
        });
    });

    describe('getCutStartPoint', () => {
        it('should handle lead calculation and return appropriate point', () => {
            const cut = createTestCut({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    fit: true,
                },
            });
            const chain = createTestChain();

            // This tests that the function works with valid inputs
            const result = getCutStartPoint(cut, chain);

            // Just verify the function returns a valid point
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should use offset chain start point when offset is available and no lead-in', () => {
            const offsetShapes: Shape[] = [
                createTestShape({ x: 5, y: 5 }, { x: 15, y: 5 }),
            ];

            const cut = createTestCut({
                leadInConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
                offset: {
                    offsetShapes,
                    originalShapes: [],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 1,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });
            const chain = createTestChain();

            const result = getCutStartPoint(cut, chain);

            // Should use offset chain start point
            expect(result).toEqual({ x: 5, y: 5 });
        });

        it('should use original chain start point when no offset and no lead-in', () => {
            const cut = createTestCut({
                leadInConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
            });
            const chain = createTestChain();

            const result = getCutStartPoint(cut, chain);

            // Should use original chain start point
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });
});
