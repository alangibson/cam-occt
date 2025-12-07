import { describe, it, expect } from 'vitest';
import { Chain } from '$lib/cam/chain/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';

describe('ChainProperties copy functionality', () => {
    it('should serialize chain correctly when copying to clipboard', () => {
        // Create a test chain with a simple line
        const lineGeometry: Line = {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
        };

        const chainData: ChainData = {
            id: 'test-chain-1',
            name: 'Test Chain',
            shapes: [
                {
                    id: 'test-shape-1',
                    type: GeometryType.LINE,
                    layer: 'layer-1',
                    geometry: lineGeometry,
                },
            ],
            clockwise: true,
        };

        const chain = new Chain(chainData);

        // Test that JSON.stringify on the chain directly returns {}
        const directStringify = JSON.stringify(chain);
        expect(directStringify).toBe('{}');

        // Test that using toData() returns valid JSON
        const dataObject = chain.toData();
        const dataStringify = JSON.stringify(dataObject, null, 2);

        // Verify the stringified data contains expected fields
        expect(dataStringify).toContain('"id": "test-chain-1"');
        expect(dataStringify).toContain('"name": "Test Chain"');
        expect(dataStringify).toContain('"clockwise": true');
        expect(dataStringify).toContain('"shapes"');

        // Verify it can be parsed back
        const parsed = JSON.parse(dataStringify);
        expect(parsed.id).toBe('test-chain-1');
        expect(parsed.name).toBe('Test Chain');
        expect(parsed.clockwise).toBe(true);
        expect(parsed.shapes).toHaveLength(1);
        expect(parsed.shapes[0].id).toBe('test-shape-1');
    });

    it('should preserve all chain data when copying', () => {
        // Create a more complex chain
        const chainData: ChainData = {
            id: 'complex-chain',
            name: 'Complex Chain',
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    layer: 'layer-1',
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 50, y: 50 },
                    },
                },
                {
                    id: 'shape-2',
                    type: GeometryType.LINE,
                    layer: 'layer-1',
                    geometry: {
                        start: { x: 50, y: 50 },
                        end: { x: 100, y: 0 },
                    },
                },
            ],
            clockwise: false,
            originalChainId: 'original-chain-id',
        };

        const chain = new Chain(chainData);
        const dataObject = chain.toData();

        // Verify all fields are preserved
        expect(dataObject.id).toBe('complex-chain');
        expect(dataObject.name).toBe('Complex Chain');
        expect(dataObject.clockwise).toBe(false);
        expect(dataObject.originalChainId).toBe('original-chain-id');
        expect(dataObject.shapes).toHaveLength(2);

        // Verify shapes are preserved
        expect(dataObject.shapes[0].id).toBe('shape-1');
        expect(dataObject.shapes[1].id).toBe('shape-2');

        // Verify the data can be stringified
        const jsonString = JSON.stringify(dataObject, null, 2);
        expect(jsonString.length).toBeGreaterThan(0);
        expect(jsonString).not.toBe('{}');
    });

    it('should handle chains with undefined optional fields', () => {
        const chainData: ChainData = {
            id: 'minimal-chain',
            name: 'Minimal Chain',
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.LINE,
                    layer: 'layer-1',
                    geometry: {
                        start: { x: 0, y: 0 },
                        end: { x: 10, y: 10 },
                    },
                },
            ],
            // clockwise and originalChainId are optional
        };

        const chain = new Chain(chainData);
        const dataObject = chain.toData();
        const jsonString = JSON.stringify(dataObject, null, 2);

        // Should still serialize successfully
        expect(jsonString).toContain('"id": "minimal-chain"');
        expect(jsonString).toContain('"name": "Minimal Chain"');

        // Parse back and verify
        const parsed = JSON.parse(jsonString);
        expect(parsed.id).toBe('minimal-chain');
        expect(parsed.shapes).toHaveLength(1);
    });
});
