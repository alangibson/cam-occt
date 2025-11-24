/**
 * Tests for Prepare Stage Store
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { prepareStageStore } from './store';
import { DEFAULT_ALGORITHM_PARAMETERS_MM } from '$lib/preprocessing/algorithm-parameters';
import { GeometryType } from '$lib/geometry/enums';
import type { ShapeData } from '$lib/cam/shape/interfaces';

describe('Prepare Stage Store', () => {
    beforeEach(() => {
        prepareStageStore.reset();
    });

    it('should initialize with default values', () => {
        const state = get(prepareStageStore);

        expect(state.algorithmParams).toEqual(DEFAULT_ALGORITHM_PARAMETERS_MM);
        expect(state.chainNormalizationResults).toEqual([]);
        expect(state.leftColumnWidth).toBe(280);
        expect(state.rightColumnWidth).toBe(280);
        expect(state.lastAnalysisTimestamp).toBe(0);
    });

    it('should update algorithm parameters', () => {
        const newParams = {
            ...DEFAULT_ALGORITHM_PARAMETERS_MM,
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
            DEFAULT_ALGORITHM_PARAMETERS_MM.chainNormalization
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
        expect(state.algorithmParams).toEqual(DEFAULT_ALGORITHM_PARAMETERS_MM);
        expect(state.chainNormalizationResults).toEqual([]);
        expect(state.leftColumnWidth).toBe(280);
        expect(state.rightColumnWidth).toBe(280);
        expect(state.lastAnalysisTimestamp).toBe(0);
    });

    describe('normalization state management', () => {
        const mockShapes: ShapeData[] = [
            {
                id: 'shape1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
            },
            {
                id: 'shape2',
                type: GeometryType.LINE,
                geometry: { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } },
            },
        ];

        const mockChains = [
            {
                id: 'chain1',
                shapes: mockShapes,
                closed: false,
                type: 'chain',
            },
        ];

        it('should save and restore original state before normalization', () => {
            // Save original state
            prepareStageStore.saveOriginalStateForNormalization(
                mockShapes,
                mockChains
            );

            // Verify state was saved
            const state = get(prepareStageStore);
            expect(state.originalShapesBeforeNormalization).not.toBeNull();
            expect(state.originalChainsBeforeNormalization).not.toBeNull();

            // Restore original state
            const restored =
                prepareStageStore.restoreOriginalStateFromNormalization();

            expect(restored).not.toBeNull();
            expect(restored?.shapes).toEqual(mockShapes);
            expect(restored?.chains).toEqual(mockChains);
        });

        it('should return null when no original state saved for normalization', () => {
            const restored =
                prepareStageStore.restoreOriginalStateFromNormalization();
            expect(restored).toBeNull();
        });

        it('should clear original normalization state', () => {
            // Save some state first
            prepareStageStore.saveOriginalStateForNormalization(
                mockShapes,
                mockChains
            );

            let state = get(prepareStageStore);
            expect(state.originalShapesBeforeNormalization).not.toBeNull();

            // Clear the state
            prepareStageStore.clearOriginalNormalizationState();

            state = get(prepareStageStore);
            expect(state.originalShapesBeforeNormalization).toBeNull();
            expect(state.originalChainsBeforeNormalization).toBeNull();
        });
    });

    describe('optimization state management', () => {
        const mockShapes: ShapeData[] = [
            {
                id: 'shape1',
                type: GeometryType.LINE,
                geometry: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
            },
            {
                id: 'shape2',
                type: GeometryType.LINE,
                geometry: { start: { x: 1, y: 1 }, end: { x: 2, y: 2 } },
            },
        ];

        const mockChains = [
            {
                id: 'chain1',
                shapes: mockShapes,
                closed: false,
                type: 'chain',
            },
        ];

        it('should save and restore original state before optimization', () => {
            // Save original state
            prepareStageStore.saveOriginalStateForOptimization(
                mockShapes,
                mockChains
            );

            // Verify state was saved
            const state = get(prepareStageStore);
            expect(state.originalShapesBeforeOptimization).not.toBeNull();
            expect(state.originalChainsBeforeOptimization).not.toBeNull();

            // Restore original state
            const restored =
                prepareStageStore.restoreOriginalStateFromOptimization();

            expect(restored).not.toBeNull();
            expect(restored?.shapes).toEqual(mockShapes);
            expect(restored?.chains).toEqual(mockChains);
        });

        it('should return null when no original state saved for optimization', () => {
            const restored =
                prepareStageStore.restoreOriginalStateFromOptimization();
            expect(restored).toBeNull();
        });

        it('should clear original optimization state', () => {
            // Save some state first
            prepareStageStore.saveOriginalStateForOptimization(
                mockShapes,
                mockChains
            );

            let state = get(prepareStageStore);
            expect(state.originalShapesBeforeOptimization).not.toBeNull();

            // Clear the state
            prepareStageStore.clearOriginalOptimizationState();

            state = get(prepareStageStore);
            expect(state.originalShapesBeforeOptimization).toBeNull();
            expect(state.originalChainsBeforeOptimization).toBeNull();
        });
    });

    describe('parts detection state', () => {
        it('should set parts detected state', () => {
            // Initially false
            let state = get(prepareStageStore);
            expect(state.partsDetected).toBe(false);

            // Set to true
            prepareStageStore.setPartsDetected(true);
            state = get(prepareStageStore);
            expect(state.partsDetected).toBe(true);

            // Set back to false
            prepareStageStore.setPartsDetected(false);
            state = get(prepareStageStore);
            expect(state.partsDetected).toBe(false);
        });
    });
});
