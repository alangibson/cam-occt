/**
 * Tests for state persistence utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveState,
    loadState,
    clearPersistedState,
    hasPersistedState,
    getPersistedStateSize,
    type PersistedState,
} from './state-persistence';
import { LeadType, CutDirection } from '../types/direction';
import { Unit } from './units';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { WorkflowStage } from '../stores/workflow';

// Mock localStorage
const localStorageMock = {
    data: {} as Record<string, string>,
    getItem: (key: string) => localStorageMock.data[key] || null,
    setItem: (key: string, value: string) => {
        localStorageMock.data[key] = value;
    },
    removeItem: (key: string) => {
        delete localStorageMock.data[key];
    },
    clear: () => {
        localStorageMock.data = {};
    },
};

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('State Persistence', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('should save and load state correctly', () => {
        const testState: PersistedState = {
            // Drawing state
            drawing: {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                units: Unit.MM,
            },
            selectedShapes: ['shape1', 'shape2'],
            hoveredShape: 'shape3',
            scale: 1.5,
            offset: { x: 100, y: 200 },
            fileName: 'test.dxf',
            layerVisibility: { layer1: true, layer2: false },
            displayUnit: Unit.MM,

            // Workflow state
            currentStage: WorkflowStage.PROGRAM,
            completedStages: [WorkflowStage.IMPORT, WorkflowStage.EDIT],

            // Chains state
            chains: [{ id: 'chain1', shapes: [] }],
            tolerance: 0.1,
            selectedChainId: 'chain1',

            // Parts state
            parts: [
                {
                    id: 'part1',
                    shell: {
                        id: 'shell1',
                        type: PartType.SHELL,
                        chain: { id: 'chain1', shapes: [] },
                        boundingBox: {
                            min: { x: 0, y: 0 },
                            max: { x: 10, y: 10 },
                        },
                        holes: [],
                    },
                    holes: [],
                },
            ],
            partWarnings: [],
            highlightedPartId: null,

            // Rapids state
            rapids: [],
            showRapids: true,
            selectedRapidId: null,
            highlightedRapidId: null,

            // UI state
            showToolTable: false,

            // Tessellation state
            tessellationActive: false,
            tessellationPoints: [],

            // Overlay state
            overlayStage: WorkflowStage.PROGRAM,
            overlays: {},

            // Lead warnings
            leadWarnings: [],

            // Prepare stage state
            prepareStageState: {
                algorithmParams: {
                    chainDetection: { tolerance: 0.1 },
                    chainNormalization: {
                        traversalTolerance: 0.01,
                        maxTraversalAttempts: 5,
                    },
                    partDetection: {
                        circleTessellationPoints: 64,
                        minArcTessellationPoints: 16,
                        arcTessellationDensity: 0.1,
                        decimalPrecision: 3,
                        enableTessellation: false,
                    },
                    joinColinearLines: { tolerance: 0.05 },
                    startPointOptimization: {
                        splitPosition: 'midpoint',
                        tolerance: 0.05,
                    },
                },
                chainNormalizationResults: [
                    {
                        chainId: 'chain1',
                        canTraverse: true,
                        description: 'Test chain',
                        issues: [],
                    },
                ],
                leftColumnWidth: 350,
                rightColumnWidth: 400,
                lastAnalysisTimestamp: Date.now(),
                originalShapesBeforeNormalization: null,
                originalChainsBeforeNormalization: null,
                originalShapesBeforeOptimization: null,
                originalChainsBeforeOptimization: null,
                partsDetected: false,
            },

            // Operations, paths, and tools
            operations: [
                {
                    id: 'op1',
                    name: 'Cut Part',
                    toolId: 'tool1',
                    targetType: 'parts',
                    targetIds: ['part1'],
                    enabled: true,
                    order: 1,
                    cutDirection: CutDirection.CLOCKWISE,
                    leadInType: LeadType.ARC,
                    leadInLength: 5,
                    leadInFlipSide: false,
                    leadInAngle: 45,
                    leadInFit: false,
                    leadOutType: LeadType.LINE,
                    leadOutLength: 3,
                    leadOutFlipSide: false,
                    leadOutAngle: 90,
                    leadOutFit: false,
                },
            ],
            paths: [
                {
                    id: 'path1',
                    name: 'Cut Path',
                    operationId: 'op1',
                    chainId: 'chain1',
                    toolId: 'tool1',
                    cutDirection: CutDirection.CLOCKWISE,
                    enabled: true,
                    order: 1,
                    calculatedLeadIn: {
                        points: [
                            { x: 0, y: 0 },
                            { x: 5, y: 5 },
                        ],
                        type: LeadType.ARC,
                        generatedAt: '2023-01-01T12:00:00.000Z',
                        version: '1.0.0',
                    },
                    calculatedLeadOut: {
                        points: [
                            { x: 10, y: 10 },
                            { x: 15, y: 15 },
                        ],
                        type: LeadType.LINE,
                        generatedAt: '2023-01-01T12:00:00.000Z',
                        version: '1.0.0',
                    },
                    leadValidation: {
                        isValid: true,
                        warnings: ['Lead may intersect with solid area'],
                        errors: [],
                        severity: 'warning',
                        validatedAt: '2023-01-01T12:00:00.000Z',
                    },
                },
            ],
            tools: [
                {
                    id: 'tool1',
                    toolNumber: 1,
                    toolName: 'Plasma Torch',
                    feedRate: 100,
                    rapidRate: 1000,
                    pierceHeight: 3,
                    pierceDelay: 0.5,
                    arcVoltage: 120,
                    kerfWidth: 1.0,
                    thcEnable: true,
                    gasPressure: 5,
                    pauseAtEnd: 0,
                    puddleJumpHeight: 0,
                    puddleJumpDelay: 0,
                    plungeRate: 50,
                },
            ],

            // Timestamp
            savedAt: '2023-01-01T00:00:00.000Z',
            selectedPathId: null,
            highlightedPathId: null,
        };

        // Save state
        saveState(testState);

        // Verify state was saved
        expect(hasPersistedState()).toBe(true);
        expect(getPersistedStateSize()).toBeGreaterThan(0);

        // Load state
        const loadedState = loadState();

        // Verify loaded state matches saved state
        expect(loadedState).toBeTruthy();
        expect(loadedState?.drawing).toEqual(testState.drawing);
        expect(loadedState?.selectedShapes).toEqual(testState.selectedShapes);
        expect(loadedState?.scale).toBe(testState.scale);
        expect(loadedState?.fileName).toBe(testState.fileName);
        expect(loadedState?.prepareStageState?.leftColumnWidth).toBe(350);
        expect(
            loadedState?.prepareStageState?.algorithmParams?.chainDetection
                ?.tolerance
        ).toBe(0.1);
        expect(loadedState?.operations?.length).toBe(1);
        expect(loadedState?.operations?.[0]?.name).toBe('Cut Part');
        expect(loadedState?.paths?.length).toBe(1);
        expect(loadedState?.tools?.length).toBe(1);
    });

    it('should handle missing state', () => {
        expect(hasPersistedState()).toBe(false);
        expect(loadState()).toBeNull();
        expect(getPersistedStateSize()).toBe(0);
    });

    it('should clear state correctly', () => {
        const testState: PersistedState = {
            drawing: null,
            selectedShapes: [],
            hoveredShape: null,
            scale: 1,
            offset: { x: 0, y: 0 },
            fileName: null,
            layerVisibility: {},
            displayUnit: Unit.MM,
            currentStage: WorkflowStage.IMPORT,
            completedStages: [],
            chains: [],
            tolerance: 0.1,
            selectedChainId: null,
            parts: [],
            partWarnings: [],
            highlightedPartId: null,
            rapids: [],
            showRapids: false,
            selectedRapidId: null,
            highlightedRapidId: null,
            showToolTable: false,
            tessellationActive: false,
            tessellationPoints: [],
            overlayStage: WorkflowStage.IMPORT,
            overlays: {},
            leadWarnings: [],
            prepareStageState: {
                algorithmParams: {
                    chainDetection: { tolerance: 0.05 },
                    chainNormalization: {
                        traversalTolerance: 0.01,
                        maxTraversalAttempts: 5,
                    },
                    partDetection: {
                        circleTessellationPoints: 64,
                        minArcTessellationPoints: 16,
                        arcTessellationDensity: 0.1,
                        decimalPrecision: 3,
                        enableTessellation: false,
                    },
                    joinColinearLines: { tolerance: 0.05 },
                    startPointOptimization: {
                        splitPosition: 'midpoint',
                        tolerance: 0.05,
                    },
                },
                chainNormalizationResults: [],
                leftColumnWidth: 280,
                rightColumnWidth: 280,
                lastAnalysisTimestamp: 0,
                originalShapesBeforeNormalization: null,
                originalChainsBeforeNormalization: null,
                originalShapesBeforeOptimization: null,
                originalChainsBeforeOptimization: null,
                partsDetected: false,
            },
            operations: [],
            paths: [],
            tools: [],
            savedAt: '2023-01-01T00:00:00.000Z',
            selectedPathId: null,
            highlightedPathId: null,
        };

        saveState(testState);
        expect(hasPersistedState()).toBe(true);

        clearPersistedState();
        expect(hasPersistedState()).toBe(false);
        expect(loadState()).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
        // Manually add invalid JSON to storage
        localStorageMock.setItem('metalheadcam-state', 'invalid json');

        expect(loadState()).toBeNull();
    });

    it('should handle version mismatch', () => {
        // Save state with different version
        const invalidState = {
            version: '0.0.1',
            drawing: null,
            savedAt: '2023-01-01T00:00:00.000Z',
        };

        localStorageMock.setItem(
            'metalheadcam-state',
            JSON.stringify(invalidState)
        );

        expect(loadState()).toBeNull();
    });
});
