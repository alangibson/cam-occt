import { describe, expect, it } from 'vitest';
import {
    prepareChainsAndLeadConfigs,
    getCutStartPoint,
} from './cut-optimization-utils';
import type { CutData } from '$lib/cam/cut/interfaces';
import type { ChainData } from '$lib/geometry/chain/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/geometry/shape/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { CutDirection, NormalSide } from './enums';
import { LeadType } from '$lib/cam/lead/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import { Cut } from './classes.svelte';
import { Chain } from '$lib/geometry/chain/classes';
import { Shape } from '$lib/geometry/shape/classes';

// Test data setup
const createTestCut = (overrides: Partial<CutData> = {}): CutData => ({
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

const createTestChain = (overrides: Partial<ChainData> = {}): ChainData => ({
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

const createTestShape = (start: Point2D, end: Point2D): ShapeData => ({
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

            const result = prepareChainsAndLeadConfigs(
                new Cut(cut),
                new Chain(chain)
            );

            expect(result.leadCalculationChain.id).toBe(chain.id);
            expect(result.leadCalculationChain.id).toBe('test-chain');
        });

        it('should create offset chain when offset shapes available', () => {
            const offsetShapes = [
                new Shape(createTestShape({ x: 1, y: 1 }, { x: 11, y: 1 })),
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

            const result = prepareChainsAndLeadConfigs(
                new Cut(cut),
                new Chain(chain)
            );

            expect(result.leadCalculationChain.id).toBe(
                'test-chain_offset_temp'
            );
            expect(result.leadCalculationChain.shapes.length).toBe(
                offsetShapes.length
            );
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

            const result = prepareChainsAndLeadConfigs(
                new Cut(cut),
                new Chain(chain)
            );

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

            const result = prepareChainsAndLeadConfigs(
                new Cut(cut),
                new Chain(chain)
            );

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

            const result = prepareChainsAndLeadConfigs(
                new Cut(cut),
                new Chain(chain)
            );

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
            const result = getCutStartPoint(new Cut(cut), new Chain(chain));

            // Just verify the function returns a valid point
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should use offset chain start point when offset is available and no lead-in', () => {
            const offsetShapes = [
                new Shape(createTestShape({ x: 5, y: 5 }, { x: 15, y: 5 })),
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

            const result = getCutStartPoint(new Cut(cut), new Chain(chain));

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

            const result = getCutStartPoint(new Cut(cut), new Chain(chain));

            // Should use original chain start point
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });
});
