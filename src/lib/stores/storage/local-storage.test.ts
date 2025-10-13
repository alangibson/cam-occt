/**
 * Tests for state persistence utilities
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    clearPersistedState,
    getPersistedStateSize,
    hasPersistedState,
    loadState,
    saveState,
} from './local-storage';
import { type PersistedState } from './interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { Unit } from '$lib/utils/units';
import { PartType } from '$lib/algorithms/part-detection/part-detection';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
} from '$lib/stores/settings/interfaces';
import { NormalSide } from '$lib/types/cam';

// Default application settings for tests
const defaultApplicationSettings = {
    measurementSystem: MeasurementSystem.Metric,
    importUnitSetting: ImportUnitSetting.Automatic,
    selectionMode: SelectionMode.Auto,
    enabledStages: [
        WorkflowStage.IMPORT,
        WorkflowStage.EDIT,
        WorkflowStage.PREPARE,
        WorkflowStage.PROGRAM,
        WorkflowStage.SIMULATE,
        WorkflowStage.EXPORT,
    ],
    enabledPreprocessingSteps: [
        PreprocessingStep.DecomposePolylines,
        PreprocessingStep.JoinColinearLines,
        PreprocessingStep.TranslateToPositive,
        PreprocessingStep.DetectChains,
        PreprocessingStep.NormalizeChains,
        PreprocessingStep.OptimizeStarts,
        PreprocessingStep.DetectParts,
    ],
    optimizationSettings: {
        cutHolesFirst: true,
        rapidOptimizationAlgorithm:
            RapidOptimizationAlgorithm.TravelingSalesman,
    },
    offsetImplementation: OffsetImplementation.Exact,
    camSettings: {
        rapidRate: 3000,
    },
};

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

            // Operations, cuts, and tools
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
                    leadInConfig: {
                        type: LeadType.ARC,
                        length: 5,
                        flipSide: false,
                        angle: 45,
                        fit: false,
                    },
                    leadOutConfig: {
                        type: LeadType.ARC,
                        length: 3,
                        flipSide: false,
                        angle: 90,
                        fit: false,
                    },
                },
            ],
            cuts: [
                {
                    id: 'path1',
                    name: 'Cut Cut',
                    operationId: 'op1',
                    chainId: 'chain1',
                    toolId: 'tool1',
                    cutDirection: CutDirection.CLOCKWISE,
                    enabled: true,
                    order: 1,
                    normal: { x: 1, y: 0 },
                    normalConnectionPoint: { x: 0, y: 0 },
                    normalSide: NormalSide.LEFT,
                    leadIn: {
                        geometry: {
                            center: { x: 2.5, y: 2.5 },
                            radius: 3.54,
                            startAngle: Math.PI / 4,
                            endAngle: (5 * Math.PI) / 4,
                            clockwise: false,
                        },
                        type: LeadType.ARC,
                        generatedAt: '2023-01-01T12:00:00.000Z',
                        version: '1.0.0',
                    },
                    leadOut: {
                        geometry: {
                            center: { x: 12.5, y: 12.5 },
                            radius: 3.536,
                            startAngle: 225,
                            endAngle: 45,
                            clockwise: false,
                        },
                        type: LeadType.ARC,
                        generatedAt: '2023-01-01T12:00:00.000Z',
                        version: '1.0.0',
                    },
                    leadValidation: {
                        isValid: true,
                        warnings: ['Lead may intersect with solid area'],
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
                    pierceHeight: 3,
                    cutHeight: 1.5,
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

            // Application settings
            applicationSettings: defaultApplicationSettings,

            // Timestamp
            savedAt: '2023-01-01T00:00:00.000Z',
            selectedCutId: null,
            highlightedCutId: null,
            showCutNormals: false,
            showCutter: false,
            showCutDirections: false,
            showCutPaths: false,
            showCutStartPoints: false,
            showCutEndPoints: false,
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
        expect(loadedState?.cuts?.length).toBe(1);
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
            cuts: [],
            tools: [],
            applicationSettings: defaultApplicationSettings,
            savedAt: '2023-01-01T00:00:00.000Z',
            selectedCutId: null,
            highlightedCutId: null,
            showCutNormals: false,
            showCutter: false,
            showCutDirections: false,
            showCutPaths: false,
            showCutStartPoints: false,
            showCutEndPoints: false,
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
