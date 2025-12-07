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
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { OperationAction } from '$lib/cam/operation/enums';
import { Unit } from '$lib/config/units/units';
import { PartType } from '$lib/cam/part/enums';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
} from '$lib/config/settings/enums';

// Default application settings for tests
const defaultApplicationSettings = {
    measurementSystem: MeasurementSystem.Metric,
    importUnitSetting: ImportUnitSetting.Automatic,
    selectionMode: SelectionMode.Auto,
    enabledStages: [
        WorkflowStage.IMPORT,
        WorkflowStage.PROGRAM,
        WorkflowStage.PROGRAM,
        WorkflowStage.PROGRAM,
        WorkflowStage.SIMULATE,
        WorkflowStage.EXPORT,
    ],
    enabledPreprocessingSteps: [
        PreprocessingStep.DecomposePolylines,
        PreprocessingStep.JoinColinearLines,
        PreprocessingStep.TranslateToPositive,
        PreprocessingStep.OptimizeStarts,
    ],
    enabledProgramSteps: [PreprocessingStep.TranslateToPositive],
    optimizationSettings: {
        cutHolesFirst: true,
        rapidOptimizationAlgorithm:
            RapidOptimizationAlgorithm.TravelingSalesman,
        zoomToFit: true,
        avoidLeadKerfOverlap: false,
    },
    offsetImplementation: OffsetImplementation.Exact,
    camSettings: {
        rapidRate: 3000,
        cutterCompensation: null,
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
                units: Unit.MM,
                fileName: '',
            },
            scale: 1.5,
            offset: { x: 100, y: 200 },
            fileName: 'test.dxf',
            layerVisibility: { layer1: true, layer2: false },
            displayUnit: Unit.MM,

            // Workflow state
            currentStage: WorkflowStage.PROGRAM,
            completedStages: [WorkflowStage.IMPORT, WorkflowStage.PROGRAM],

            // Chains state
            chains: [{ id: 'chain1', name: 'chain1', shapes: [] }],
            tolerance: 0.1,

            // Parts state
            parts: [
                {
                    id: 'part1',
                    name: 'Test Part',
                    type: PartType.SHELL,
                    shell: { id: 'chain1', name: 'chain1', shapes: [] },
                    boundingBox: {
                        min: { x: 0, y: 0 },
                        max: { x: 10, y: 10 },
                    },
                    voids: [],
                    slots: [],
                    layerName: '0',
                },
            ],
            partWarnings: [],

            // Rapids state
            showRapids: true,

            // UI state
            showToolTable: false,

            // Tessellation state
            tessellationActive: false,
            tessellationPoints: [],

            // Overlay state
            overlayStage: WorkflowStage.PROGRAM,
            overlays: {},

            // Operations, cuts, and tools
            operations: [
                {
                    id: 'op1',
                    name: 'Cut Part',
                    action: OperationAction.CUT,
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
                    sourceOperationId: 'op1',
                    sourceChainId: 'chain1',
                    sourceToolId: 'tool1',
                    action: OperationAction.CUT,
                    direction: CutDirection.CLOCKWISE,
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
            showCutNormals: false,
            showCutDirections: false,
            showCutPaths: false,
            showCutStartPoints: false,
            showCutEndPoints: false,
            showCutTangentLines: false,

            // Unified selection state
            selection: {
                shapes: {
                    selected: ['shape1', 'shape2'],
                    hovered: 'shape3',
                    selectedOffset: null,
                },
                chains: {
                    selected: ['chain1'],
                    highlighted: null,
                },
                parts: {
                    selected: [],
                    highlighted: null,
                    hovered: null,
                },
                cuts: {
                    selected: [],
                    highlighted: null,
                },
                rapids: {
                    selected: [],
                    highlighted: null,
                },
                leads: {
                    selected: [],
                    highlighted: null,
                },
                kerfs: {
                    selected: null,
                    highlighted: null,
                },
            },
        };

        // Save state
        saveState(testState);

        // Load state
        const loadedState = loadState();

        // Verify loaded state matches saved state
        expect(loadedState).toBeTruthy();
        expect(loadedState?.drawing).toEqual(testState.drawing);
        expect(loadedState?.selection).toEqual(testState.selection);
        expect(loadedState?.scale).toBe(testState.scale);
        expect(loadedState?.fileName).toBe(testState.fileName);
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
            scale: 1,
            offset: { x: 0, y: 0 },
            fileName: null,
            layerVisibility: {},
            displayUnit: Unit.MM,
            currentStage: WorkflowStage.IMPORT,
            completedStages: [],
            chains: [],
            tolerance: 0.1,
            parts: [],
            partWarnings: [],
            showRapids: false,
            showToolTable: false,
            tessellationActive: false,
            tessellationPoints: [],
            overlayStage: WorkflowStage.IMPORT,
            overlays: {},
            operations: [],
            cuts: [],
            tools: [],
            applicationSettings: defaultApplicationSettings,
            savedAt: '2023-01-01T00:00:00.000Z',
            showCutNormals: false,
            showCutDirections: false,
            showCutPaths: false,
            showCutStartPoints: false,
            showCutEndPoints: false,
            showCutTangentLines: false,
            selection: {
                shapes: {
                    selected: [],
                    hovered: null,
                    selectedOffset: null,
                },
                chains: {
                    selected: [],
                    highlighted: null,
                },
                parts: {
                    selected: [],
                    highlighted: null,
                    hovered: null,
                },
                cuts: {
                    selected: [],
                    highlighted: null,
                },
                rapids: {
                    selected: [],
                    highlighted: null,
                },
                leads: {
                    selected: [],
                    highlighted: null,
                },
                kerfs: {
                    selected: null,
                    highlighted: null,
                },
            },
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
