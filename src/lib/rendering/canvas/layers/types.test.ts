/**
 * Tests for layer types and configurations
 */

import { describe, it, expect } from 'vitest';
import { LayerId, DEFAULT_LAYER_CONFIGS } from './types';

describe('LayerId enum', () => {
    it('should have all expected layer IDs', () => {
        expect(LayerId.BACKGROUND).toBe('background');
        expect(LayerId.SHAPES).toBe('shapes');
        expect(LayerId.CHAINS).toBe('chains');
        expect(LayerId.PARTS).toBe('parts');
        expect(LayerId.PATHS).toBe('paths');
        expect(LayerId.OFFSETS).toBe('offsets');
        expect(LayerId.LEADS).toBe('leads');
        expect(LayerId.RAPIDS).toBe('rapids');
        expect(LayerId.OVERLAYS).toBe('overlays');
        expect(LayerId.SELECTION).toBe('selection');
        expect(LayerId.INTERACTION).toBe('interaction');
    });
});

describe('DEFAULT_LAYER_CONFIGS', () => {
    it('should have configurations for all layer IDs', () => {
        const layerIds = Object.values(LayerId);
        const configIds = DEFAULT_LAYER_CONFIGS.map((config) => config.id);

        expect(configIds).toHaveLength(layerIds.length);

        for (const layerId of layerIds) {
            expect(configIds).toContain(layerId);
        }
    });

    it('should have unique z-index values', () => {
        const zIndexes = DEFAULT_LAYER_CONFIGS.map((config) => config.zIndex);
        const uniqueZIndexes = new Set(zIndexes);

        expect(uniqueZIndexes.size).toBe(zIndexes.length);
    });

    it('should have proper z-order (background lowest, interaction highest)', () => {
        const backgroundConfig = DEFAULT_LAYER_CONFIGS.find(
            (c) => c.id === LayerId.BACKGROUND
        );
        const interactionConfig = DEFAULT_LAYER_CONFIGS.find(
            (c) => c.id === LayerId.INTERACTION
        );

        expect(backgroundConfig).toBeDefined();
        expect(interactionConfig).toBeDefined();
        expect(backgroundConfig!.zIndex).toBeLessThan(
            interactionConfig!.zIndex
        );
    });

    it('should mark interaction layer as transparent but visible for event handling', () => {
        const interactionConfig = DEFAULT_LAYER_CONFIGS.find(
            (c) => c.id === LayerId.INTERACTION
        );

        expect(interactionConfig).toBeDefined();
        expect(interactionConfig!.visible).toBe(true);
        expect(interactionConfig!.opacity).toBe(0); // Transparent
    });

    it('should mark all other layers as visible by default', () => {
        const visibleConfigs = DEFAULT_LAYER_CONFIGS.filter(
            (c) => c.id !== LayerId.INTERACTION
        );

        for (const config of visibleConfigs) {
            expect(config.visible).toBe(true);
        }
    });
});
