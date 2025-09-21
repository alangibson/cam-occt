import { describe, expect, it } from 'vitest';
import {
    prepareChainsAndLeadConfigs,
    getPathStartPoint,
} from './path-optimization-utils';
import type { Path } from '$lib/stores/paths/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Line, Point2D, Shape } from '$lib/types/geometry';
import { GeometryType } from '$lib/types/geometry';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';

// Test data setup
const createTestPath = (overrides: Partial<Path> = {}): Path => ({
    id: 'test-path',
    name: 'Test Path',
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

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadCalculationChain.id).toBe(
                'test-chain_offset_temp'
            );
            expect(result.leadCalculationChain.shapes).toBe(offsetShapes);
        });

        it('should create correct lead-in config', () => {
            const path = createTestPath({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 10,
                    flipSide: true,
                    angle: 45,
                    fit: true,
                },
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadInConfig.type).toBe(LeadType.ARC);
            expect(result.leadInConfig.length).toBe(10);
            expect(result.leadInConfig.flipSide).toBe(true);
            expect(result.leadInConfig.angle).toBe(45);
        });

        it('should create correct lead-out config', () => {
            const path = createTestPath({
                leadOutConfig: {
                    type: LeadType.ARC,
                    length: 15,
                    flipSide: false,
                    angle: 90,
                    fit: true,
                },
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
                leadInConfig: undefined,
                leadOutConfig: undefined,
            });
            const chain = createTestChain();

            const result = prepareChainsAndLeadConfigs(path, chain);

            expect(result.leadInConfig.type).toBe(LeadType.NONE);
            expect(result.leadInConfig.length).toBe(0);
            expect(result.leadOutConfig.type).toBe(LeadType.NONE);
            expect(result.leadOutConfig.length).toBe(0);
        });
    });

    describe('getPathStartPoint', () => {
        it('should handle lead calculation and return appropriate point', () => {
            const path = createTestPath({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    fit: true,
                },
            });
            const chain = createTestChain();

            // This tests that the function works with valid inputs
            const result = getPathStartPoint(path, chain);

            // Just verify the function returns a valid point
            expect(typeof result.x).toBe('number');
            expect(typeof result.y).toBe('number');
        });

        it('should use offset chain start point when offset is available and no lead-in', () => {
            const offsetShapes: Shape[] = [
                createTestShape({ x: 5, y: 5 }, { x: 15, y: 5 }),
            ];

            const path = createTestPath({
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

            const result = getPathStartPoint(path, chain);

            // Should use offset chain start point
            expect(result).toEqual({ x: 5, y: 5 });
        });

        it('should use original chain start point when no offset and no lead-in', () => {
            const path = createTestPath({
                leadInConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
            });
            const chain = createTestChain();

            const result = getPathStartPoint(path, chain);

            // Should use original chain start point
            expect(result).toEqual({ x: 0, y: 0 });
        });
    });
});
