/**
 * Tests for Prepare Stage Store
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { prepareStageStore } from './prepare-stage';
import { DEFAULT_ALGORITHM_PARAMETERS } from '$lib/types/algorithm-parameters';

describe('Prepare Stage Store', () => {
    beforeEach(() => {
        prepareStageStore.reset();
    });

    it('should initialize with default values', () => {
        const state = get(prepareStageStore);

        expect(state.algorithmParams).toEqual(DEFAULT_ALGORITHM_PARAMETERS);
        expect(state.chainNormalizationResults).toEqual([]);
        expect(state.leftColumnWidth).toBe(280);
        expect(state.rightColumnWidth).toBe(280);
        expect(state.lastAnalysisTimestamp).toBe(0);
    });

    it('should update algorithm parameters', () => {
        const newParams = {
            ...DEFAULT_ALGORITHM_PARAMETERS,
            chainDetection: { tolerance: 0.1 },
        };

        prepareStageStore.setAlgorithmParams(newParams);

        const state = get(prepareStageStore);
        expect(state.algorithmParams.chainDetection.tolerance).toBe(0.1);
    });

    it('should update specific algorithm parameter', () => {
        prepareStageStore.updateAlgorithmParam('chainDetection', {
            tolerance: 0.2,
        });

        const state = get(prepareStageStore);
        expect(state.algorithmParams.chainDetection.tolerance).toBe(0.2);
        expect(state.algorithmParams.chainNormalization).toEqual(
            DEFAULT_ALGORITHM_PARAMETERS.chainNormalization
        );
    });

    it('should set and clear chain normalization results', () => {
        const mockResults = [
            {
                chainId: 'chain1',
                canTraverse: true,
                description: 'Test chain',
                issues: [],
            },
        ];

        prepareStageStore.setChainNormalizationResults(mockResults);

        let state = get(prepareStageStore);
        expect(state.chainNormalizationResults).toEqual(mockResults);
        expect(state.lastAnalysisTimestamp).toBeGreaterThan(0);

        prepareStageStore.clearChainNormalizationResults();

        state = get(prepareStageStore);
        expect(state.chainNormalizationResults).toEqual([]);
        expect(state.lastAnalysisTimestamp).toBe(0);
    });

    it('should update column widths', () => {
        prepareStageStore.setColumnWidths(350, 400);

        const state = get(prepareStageStore);
        expect(state.leftColumnWidth).toBe(350);
        expect(state.rightColumnWidth).toBe(400);
    });

    it('should get chain normalization result by ID', () => {
        const mockResults = [
            {
                chainId: 'chain1',
                canTraverse: true,
                description: 'Test chain 1',
                issues: [],
            },
            {
                chainId: 'chain2',
                canTraverse: false,
                description: 'Test chain 2',
                issues: [],
            },
        ];

        prepareStageStore.setChainNormalizationResults(mockResults);

        const result1 = prepareStageStore.getChainNormalizationResult('chain1');
        const result2 = prepareStageStore.getChainNormalizationResult('chain2');
        const result3 =
            prepareStageStore.getChainNormalizationResult('nonexistent');

        expect(result1?.chainId).toBe('chain1');
        expect(result1?.canTraverse).toBe(true);
        expect(result2?.chainId).toBe('chain2');
        expect(result2?.canTraverse).toBe(false);
        expect(result3).toBeNull();
    });

    it('should reset to defaults', () => {
        // Make some changes
        prepareStageStore.setColumnWidths(500, 600);
        prepareStageStore.updateAlgorithmParam('chainDetection', {
            tolerance: 0.5,
        });
        prepareStageStore.setChainNormalizationResults([
            {
                chainId: 'test',
                canTraverse: true,
                description: 'Test',
                issues: [],
            },
        ]);

        // Verify changes were made
        let state = get(prepareStageStore);
        expect(state.leftColumnWidth).toBe(500);
        expect(state.algorithmParams.chainDetection.tolerance).toBe(0.5);
        expect(state.chainNormalizationResults.length).toBe(1);

        // Reset
        prepareStageStore.reset();

        // Verify reset to defaults
        state = get(prepareStageStore);
        expect(state.algorithmParams).toEqual(DEFAULT_ALGORITHM_PARAMETERS);
        expect(state.chainNormalizationResults).toEqual([]);
        expect(state.leftColumnWidth).toBe(280);
        expect(state.rightColumnWidth).toBe(280);
        expect(state.lastAnalysisTimestamp).toBe(0);
    });
});
