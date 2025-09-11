import { describe, it, expect } from 'vitest';
import {
    prepareChainsAndLeadConfigs,
    getChainEndPoint,
} from './path-optimization-utils';
import type { Path } from '../stores/paths';
import type { Chain } from '$lib/algorithms/chain-detection/chain-detection';
import type { Shape, Line, Point2D } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import { LeadType, CutDirection } from '../types/direction';
import { OffsetDirection } from './offset-calculation/offset/types';

// Test data setup
const createTestPath = (overrides: Partial<Path> = {}): Path => ({
    id: 'test-path',
    name: 'Test Path',
    operationId: 'test-operation',
    chainId: 'test-chain',
    toolId: 'test-tool',
    enabled: true,
    order: 1,
    leadInType: LeadType.LINE,
    leadInLength: 5,
    leadInFlipSide: false,
    leadOutType: LeadType.LINE,
    leadOutLength: 5,
    leadOutFlipSide: false,
    cutDirection: CutDirection.CLOCKWISE,
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

describe('path-optimization-utils', () => {
    describe('prepareChainsAndLeadConfigs', () => {
        it('should use original chain when no offset shapes available', () => {
            const path = createTestPath();
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadCalculationChain).toBe(chain);
            expect(result.leadCalculationChain.id).toBe('test-chain');
        });

        it('should create offset chain when offset shapes available', () => {
            const offsetShapes: Shape[] = [
                createTestShape({ x: 1, y: 1 }, { x: 11, y: 1 }),
            ];

            const path = createTestPath({
                calculatedOffset: {
                    offsetShapes,
                    originalShapes: [],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 1,
                    generatedAt: new Date().toISOString(),
                    version: '1.0.0',
                },
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadCalculationChain.id).toBe(
                'test-chain_offset_temp'
            );
            expect(result.leadCalculationChain.shapes).toBe(offsetShapes);
        });

        it('should create correct lead-in config', () => {
            const path = createTestPath({
                leadInType: LeadType.LINE,
                leadInLength: 10,
                leadInFlipSide: true,
                leadInAngle: 45,
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadInConfig.type).toBe(LeadType.LINE);
            expect(result.leadInConfig.length).toBe(10);
            expect(result.leadInConfig.flipSide).toBe(true);
            expect(result.leadInConfig.angle).toBe(45);
        });

        it('should create correct lead-out config', () => {
            const path = createTestPath({
                leadOutType: LeadType.ARC,
                leadOutLength: 15,
                leadOutFlipSide: false,
                leadOutAngle: 90,
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadOutConfig.type).toBe(LeadType.ARC);
            expect(result.leadOutConfig.length).toBe(15);
            expect(result.leadOutConfig.flipSide).toBe(false);
            expect(result.leadOutConfig.angle).toBe(90);
        });

        it('should handle missing lead config values with defaults', () => {
            const path = createTestPath({
                leadInType: undefined,
                leadInLength: undefined,
                leadOutType: undefined,
                leadOutLength: undefined,
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadInConfig.type).toBe(LeadType.NONE);
            expect(result.leadInConfig.length).toBe(0);
            expect(result.leadOutConfig.type).toBe(LeadType.NONE);
            expect(result.leadOutConfig.length).toBe(0);
        });
    });

    describe('getChainEndPoint', () => {
        it('should return end point of last shape in chain', () => {
            const chain = createTestChain({
                shapes: [
                    createTestShape({ x: 0, y: 0 }, { x: 5, y: 0 }),
                    createTestShape({ x: 5, y: 0 }, { x: 10, y: 5 }),
                    createTestShape({ x: 10, y: 5 }, { x: 15, y: 10 }),
                ],
            });

            const endPoint = getChainEndPoint(chain);

            expect(endPoint).toEqual({ x: 15, y: 10 });
        });

        it('should handle chain with single shape', () => {
            const chain = createTestChain({
                shapes: [createTestShape({ x: 2, y: 3 }, { x: 8, y: 7 })],
            });

            const endPoint = getChainEndPoint(chain);

            expect(endPoint).toEqual({ x: 8, y: 7 });
        });

        it('should throw error for empty chain', () => {
            const chain = createTestChain({
                shapes: [],
            });

            expect(() => getChainEndPoint(chain)).toThrow(
                'Chain has no shapes'
            );
        });

        it('should work with different shape types', () => {
            const arcShape: Shape = {
                id: 'arc1',
                type: GeometryType.ARC,
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: true,
                },
            };

            const chain = createTestChain({
                shapes: [arcShape],
            });

            const endPoint = getChainEndPoint(chain);

            // For an arc from 0 to π/2, end point should be (0, 5)
            expect(endPoint.x).toBeCloseTo(0);
            expect(endPoint.y).toBeCloseTo(5);
        });
    });
});
