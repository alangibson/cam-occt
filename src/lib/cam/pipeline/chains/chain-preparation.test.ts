/**
 * Chain Preparation Tests
 *
 * Tests for chain direction analysis and cut chain creation.
 */

import { describe, it, expect } from 'vitest';
import { createCutChain } from './functions';
import { getChainCutDirection } from '$lib/cam/chain/functions';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CutDirection } from '$lib/cam/cut/enums';
import { GeometryType } from '$lib/geometry/enums';
import { Shape } from '$lib/cam/shape/classes';

describe('getChainCutDirection', () => {
    it('should return NONE for undefined chain', () => {
        expect(getChainCutDirection(undefined)).toBe(CutDirection.NONE);
    });

    it('should return CLOCKWISE for chain with clockwise=true', () => {
        const chain: ChainData = {
            id: 'test-chain',
            shapes: [],
            clockwise: true,
        };
        expect(getChainCutDirection(chain)).toBe(CutDirection.CLOCKWISE);
    });

    it('should return COUNTERCLOCKWISE for chain with clockwise=false', () => {
        const chain: ChainData = {
            id: 'test-chain',
            shapes: [],
            clockwise: false,
        };
        expect(getChainCutDirection(chain)).toBe(CutDirection.COUNTERCLOCKWISE);
    });

    it('should return NONE for chain with clockwise=null', () => {
        const chain: ChainData = {
            id: 'test-chain',
            shapes: [],
            clockwise: null,
        };
        expect(getChainCutDirection(chain)).toBe(CutDirection.NONE);
    });

    it('should return NONE for chain without clockwise property', () => {
        const chain: ChainData = {
            id: 'test-chain',
            shapes: [],
        };
        expect(getChainCutDirection(chain)).toBe(CutDirection.NONE);
    });
});

describe('createCutChain', () => {
    const createTestShape = (id: string) => ({
        id,
        type: GeometryType.LINE,
        geometry: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
        },
    });

    it('should deep clone shapes', () => {
        const shape1 = createTestShape('shape1');
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [shape1],
            clockwise: true,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.CLOCKWISE,
            undefined
        );

        // Shapes should be cloned, not same reference
        expect(result.cutChain.shapes[0]).not.toBe(shape1);
        expect(result.cutChain.shapes[0].id).toBe(shape1.id);
        expect(result.cutChain.shapes[0].geometry).not.toBe(shape1.geometry);
    });

    it('should use offset shapes when provided', () => {
        const originalShape = createTestShape('original');
        const offsetShape = new Shape(createTestShape('offset'));
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [originalShape],
            clockwise: true,
        };

        const result = createCutChain(originalChain, CutDirection.CLOCKWISE, [
            offsetShape,
        ]);

        expect(result.cutChain.shapes[0].id).toBe('offset');
    });

    it('should return executionClockwise=null when userCutDirection is NONE', () => {
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [createTestShape('shape1')],
            clockwise: true,
        };

        const result = createCutChain(originalChain, CutDirection.NONE);

        expect(result.executionClockwise).toBe(null);
    });

    it('should preserve original order for closed chain when directions match', () => {
        const shape1 = createTestShape('shape1');
        const shape2 = createTestShape('shape2');
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [shape1, shape2],
            clockwise: true,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.CLOCKWISE,
            undefined
        );

        expect(result.cutChain.shapes[0].id).toBe('shape1');
        expect(result.cutChain.shapes[1].id).toBe('shape2');
        expect(result.executionClockwise).toBe(true);
    });

    it('should reverse chain when user direction is opposite of natural direction', () => {
        const shape1 = createTestShape('shape1');
        const shape2 = createTestShape('shape2');
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [shape1, shape2],
            clockwise: true,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.COUNTERCLOCKWISE,
            undefined
        );

        // Shapes should be reversed
        expect(result.cutChain.shapes[0].id).toBe('shape2');
        expect(result.cutChain.shapes[1].id).toBe('shape1');
        expect(result.executionClockwise).toBe(false);
    });

    it('should preserve originalChainId reference', () => {
        const originalChain: ChainData = {
            id: 'original-chain-id',
            shapes: [createTestShape('shape1')],
            clockwise: true,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.CLOCKWISE,
            undefined
        );

        expect(result.cutChain.originalChainId).toBe('original-chain-id');
    });

    it('should set clockwise property to execution direction', () => {
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [createTestShape('shape1')],
            clockwise: true,
        };

        const resultCW = createCutChain(
            originalChain,
            CutDirection.CLOCKWISE,
            undefined
        );
        expect(resultCW.cutChain.clockwise).toBe(true);

        const resultCCW = createCutChain(
            originalChain,
            CutDirection.COUNTERCLOCKWISE,
            undefined
        );
        expect(resultCCW.cutChain.clockwise).toBe(false);
    });

    it('should handle open chains (clockwise=null) with CLOCKWISE direction', () => {
        const shape1 = createTestShape('shape1');
        const shape2 = createTestShape('shape2');
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [shape1, shape2],
            clockwise: null,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.CLOCKWISE,
            undefined
        );

        expect(result.cutChain.shapes[0].id).toBe('shape1');
        expect(result.cutChain.shapes[1].id).toBe('shape2');
        expect(result.executionClockwise).toBe(true);
    });

    it('should handle open chains (clockwise=null) with COUNTERCLOCKWISE direction', () => {
        const shape1 = createTestShape('shape1');
        const shape2 = createTestShape('shape2');
        const originalChain: ChainData = {
            id: 'test-chain',
            shapes: [shape1, shape2],
            clockwise: null,
        };

        const result = createCutChain(
            originalChain,
            CutDirection.COUNTERCLOCKWISE,
            undefined
        );

        // Should reverse for open chains
        expect(result.cutChain.shapes[0].id).toBe('shape2');
        expect(result.cutChain.shapes[1].id).toBe('shape1');
        expect(result.executionClockwise).toBe(false);
    });
});
