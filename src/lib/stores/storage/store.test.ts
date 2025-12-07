import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveApplicationState,
    autoSaveApplicationState,
    restoreApplicationState,
    clearApplicationState,
    setupAutoSave,
} from './store';
import * as localStorage from './local-storage';
import { drawingStore } from '$lib/stores/drawing/store.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { chainStore } from '$lib/stores/chains/store.svelte';
import { partStore } from '$lib/stores/parts/store.svelte';
import { rapidStore } from '$lib/stores/rapids/store.svelte';
import { selectionStore } from '$lib/stores/selection/store.svelte';
import { uiStore } from '$lib/stores/ui/store.svelte';
import { tessellationStore } from '$lib/stores/tessellation/store.svelte';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import { cutStore } from '$lib/stores/cuts/store.svelte';
import { toolStore } from '$lib/stores/tools/store.svelte';
import { settingsStore } from '$lib/stores/settings/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { Unit } from '$lib/config/units/units';
import type { PersistedState } from './interfaces';
import {
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
} from '$lib/config/settings/enums';
import { CutterCompensation } from '$lib/cam/gcode/enums';

// Default application settings for tests - must match DEFAULT_SETTINGS from config
// IMPORTANT: Defined before vi.mock calls since mocks are hoisted
const defaultApplicationSettings = {
    measurementSystem: MeasurementSystem.Metric,
    importUnitSetting: ImportUnitSetting.Automatic,
    selectionMode: SelectionMode.Auto,
    enabledStages: [
        WorkflowStage.IMPORT,
        WorkflowStage.PROGRAM,
        WorkflowStage.SIMULATE,
        WorkflowStage.EXPORT,
    ],
    enabledPreprocessingSteps: [
        PreprocessingStep.DecomposePolylines,
        PreprocessingStep.DeduplicateShapes,
        PreprocessingStep.TranslateToPositive,
    ],
    enabledProgramSteps: [PreprocessingStep.TranslateToPositive],
    optimizationSettings: {
        cutHolesFirst: true,
        rapidOptimizationAlgorithm:
            RapidOptimizationAlgorithm.TravelingSalesman,
        zoomToFit: true,
        avoidLeadKerfOverlap: false,
    },
    offsetImplementation: OffsetImplementation.Polyline,
    camSettings: {
        rapidRate: 3000,
        cutterCompensation: CutterCompensation.SOFTWARE,
    },
};

// Mock localStorage module
vi.mock('./local-storage', () => ({
    saveState: vi.fn(),
    debouncedSave: vi.fn(),
    loadState: vi.fn(),
    clearPersistedState: vi.fn(),
}));

// Mock store methods
vi.mock('../chains/store.svelte', () => ({
    chainStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setChains: vi.fn(),
        setTolerance: vi.fn(),
        selectChain: vi.fn(),
    },
}));

vi.mock('../parts/store.svelte', () => ({
    partStore: {
        warnings: [],
        setWarnings: vi.fn(),
        clearParts: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('../drawing/store.svelte', () => ({
    drawingStore: {
        drawing: {
            shapes: [],
            bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
            units: 2, // Unit.MM
            fileName: 'test.dxf',
            layers: {},
            toData: () => ({
                shapes: [],
                bounds: {
                    min: { x: 0, y: 0 },
                    max: { x: 100, y: 100 },
                },
                units: 2, // Unit.MM
                fileName: 'test.dxf',
            }),
        },
        scale: 1.5,
        offset: { x: 10, y: 20 },
        displayUnit: 'mm',
        layerVisibility: { layer1: true, layer2: false },
        isDragging: false,
        dragStart: null,
        canvasDimensions: null,
        restoreDrawing: vi.fn(),
        setLayerVisibility: vi.fn(),
        setDrawing: vi.fn(),
        setViewTransform: vi.fn(),
        setCanvasDimensions: vi.fn(),
        zoomToFit: vi.fn(),
        setDisplayUnit: vi.fn(),
        reset: vi.fn(),
    },
}));

vi.mock('../workflow/store.svelte', () => ({
    workflowStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        restore: vi.fn(),
        currentStage: 'import',
        completedStages: ['import'],
        canAdvanceTo: vi.fn(),
    },
}));

vi.mock('../rapids/store.svelte', () => ({
    rapidStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setRapids: vi.fn(),
        setShowRapids: vi.fn(),
    },
}));

vi.mock('../selection/store.svelte', () => ({
    selectionStore: {
        shapes: {
            selected: new Set(['shape1']),
            hovered: 'shape2',
            selectedOffset: null,
        },
        chains: { selected: new Set(), highlighted: null },
        parts: { selected: new Set(), highlighted: null, hovered: null },
        cuts: { selected: new Set(), highlighted: null },
        rapids: { selected: new Set(), highlighted: null },
        leads: { selected: new Set(), highlighted: null },
        kerfs: { selected: null, highlighted: null },
        selectRapids: vi.fn(),
        highlightRapid: vi.fn(),
        reset: vi.fn(),
        getState: vi.fn(() => ({
            shapes: {
                selected: ['shape1'],
                hovered: 'shape2',
                selectedOffset: null,
            },
            chains: { selected: [], highlighted: null },
            parts: { selected: [], highlighted: null, hovered: null },
            cuts: { selected: [], highlighted: null },
            rapids: { selected: [], highlighted: null },
            leads: { selected: [], highlighted: null },
            kerfs: { selected: null, highlighted: null },
        })),
    },
}));

vi.mock('../ui/store.svelte', () => ({
    uiStore: {
        toolTableVisible: false,
        settingsVisible: false,
        showToolTable: vi.fn(),
        hideToolTable: vi.fn(),
        showSettings: vi.fn(),
        hideSettings: vi.fn(),
        toggleToolTable: vi.fn(),
        toggleSettings: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('../tessellation/store.svelte', () => ({
    tessellationStore: {
        isActive: false,
        points: [],
        lastUpdate: 0,
        setTessellation: vi.fn(),
        clearTessellation: vi.fn(),
    },
}));

vi.mock('../overlay/store.svelte', () => ({
    overlayStore: {
        currentStage: 'import',
        overlays: {},
        setCurrentStage: vi.fn(),
        setShapePoints: vi.fn(),
        setChainEndpoints: vi.fn(),
        setTessellationPoints: vi.fn(),
        setToolHead: vi.fn(),
        clearShapePoints: vi.fn(),
        clearChainEndpoints: vi.fn(),
        clearTessellationPoints: vi.fn(),
        clearToolHead: vi.fn(),
        clearStageOverlay: vi.fn(),
        clearAllOverlays: vi.fn(),
        getCurrentOverlay: vi.fn(),
        restore: vi.fn(),
    },
}));

vi.mock('../operations/store.svelte', () => ({
    operationsStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        reorderOperations: vi.fn(),
        operations: [],
    },
}));

vi.mock('../cuts/store.svelte', () => ({
    cutStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        restore: vi.fn(),
    },
}));

vi.mock('../tools/store.svelte', () => ({
    toolStore: {
        tools: [],
        reorderTools: vi.fn(),
        addTool: vi.fn(),
        updateTool: vi.fn(),
        deleteTool: vi.fn(),
        reset: vi.fn(),
    },
}));

vi.mock('../settings/store.svelte', () => {
    const mockSettings = {
        measurementSystem: 'metric',
        importUnitSetting: 'automatic',
        selectionMode: 'auto',
        enabledStages: ['import', 'program', 'simulate', 'export'],
        enabledPreprocessingSteps: [
            'decomposePolylines',
            'deduplicateShapes',
            'translateToPositive',
        ],
        enabledProgramSteps: ['translateToPositive'],
        optimizationSettings: {
            cutHolesFirst: true,
            rapidOptimizationAlgorithm: 'traveling-salesman',
            zoomToFit: true,
            avoidLeadKerfOverlap: false,
        },
        offsetImplementation: 'polyline',
        camSettings: {
            rapidRate: 3000,
            cutterCompensation: 'software',
        },
    };
    return {
        settingsStore: {
            subscribe: vi.fn((fn) => {
                fn({ settings: mockSettings });
                return () => {};
            }),
            settings: mockSettings,
        },
    };
});

// Mock get function from svelte/store
vi.mock('svelte/store', () => ({
    get: vi.fn((store) => {
        // Return appropriate mock data based on which store is being accessed
        if (store === drawingStore) {
            return {
                drawing: {
                    shapes: [],
                    bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
                    units: Unit.MM,
                    fileName: 'test.dxf',
                    layers: {},
                    toData: () => ({
                        shapes: [],
                        bounds: {
                            min: { x: 0, y: 0 },
                            max: { x: 100, y: 100 },
                        },
                        units: Unit.MM,
                        fileName: 'test.dxf',
                    }),
                },
                scale: 1.5,
                offset: { x: 10, y: 20 },
                layerVisibility: { layer1: true, layer2: false },
                displayUnit: 'mm',
            };
        }
        if (store === workflowStore) {
            return {
                currentStage: WorkflowStage.IMPORT,
                completedStages: new Set([WorkflowStage.IMPORT]),
            };
        }
        if (store === chainStore) {
            return {
                chains: [],
                tolerance: 0.001,
            };
        }
        if (store === partStore) {
            return {
                parts: [],
                warnings: [],
            };
        }
        if (store === rapidStore) {
            return {
                showRapids: false,
            };
        }
        if (store === selectionStore) {
            return {
                shapes: {
                    selected: new Set<string>(['shape1']),
                    hovered: 'shape2',
                    selectedOffset: null,
                },
                chains: {
                    selected: new Set(),
                    highlighted: null,
                },
                parts: {
                    selected: new Set(),
                    highlighted: null,
                    hovered: null,
                },
                cuts: {
                    selected: new Set(),
                    highlighted: null,
                },
                rapids: {
                    selected: new Set(),
                    highlighted: null,
                },
                leads: {
                    selected: new Set(),
                    highlighted: null,
                },
                kerfs: {
                    selected: null,
                },
            };
        }
        if (store === uiStore) {
            return {
                showToolTable: false,
            };
        }
        if (store === tessellationStore) {
            return {
                isActive: false,
                points: [],
            };
        }
        if (store === overlayStore) {
            return {
                currentStage: WorkflowStage.IMPORT,
                overlays: {},
            };
        }
        if (store === operationsStore) {
            return [];
        }
        if (store === cutStore) {
            return {
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
            };
        }
        if (store === toolStore) {
            return [];
        }
        if (store === settingsStore) {
            return { settings: defaultApplicationSettings };
        }
        return {};
    }),
    writable: vi.fn(() => ({
        subscribe: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
    })),
}));

describe('storage/store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveApplicationState', () => {
        it('should collect current state and save it', () => {
            saveApplicationState();

            expect(localStorage.saveState).toHaveBeenCalledWith(
                expect.objectContaining({
                    selection: expect.objectContaining({
                        shapes: expect.objectContaining({
                            selected: ['shape1'],
                            hovered: 'shape2',
                        }),
                    }),
                    scale: 1.5,
                    offset: { x: 10, y: 20 },
                    fileName: 'test.dxf',
                    displayUnit: 'mm',
                    currentStage: WorkflowStage.IMPORT,
                    completedStages: [WorkflowStage.IMPORT],
                    applicationSettings: defaultApplicationSettings,
                    savedAt: expect.any(String),
                })
            );
        });
    });

    describe('autoSaveApplicationState', () => {
        it('should use debounced save', () => {
            autoSaveApplicationState();

            expect(localStorage.debouncedSave).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationSettings: defaultApplicationSettings,
                    savedAt: expect.any(String),
                })
            );
        });
    });

    describe('restoreApplicationState', () => {
        it('should return false when no saved state exists', () => {
            vi.mocked(localStorage.loadState).mockReturnValue(null);

            const result = restoreApplicationState();

            expect(result).toBe(false);
            // NOTE: chainStore.setChains no longer exists - chains are auto-detected from Drawing layers
        });

        it('should restore state with selectedChainId', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: ['chain-123'], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            const result = restoreApplicationState();

            expect(result).toBe(true);
        });

        it('should restore state with highlightedPartId', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: {
                        selected: [],
                        highlighted: 'part-456',
                        hovered: null,
                    },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();
        });

        it('should restore state with inch display unit', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'inch',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
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

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(drawingStore.restoreDrawing).toHaveBeenCalledWith(
                expect.objectContaining({ units: Unit.MM }),
                'test.dxf',
                1,
                { x: 0, y: 0 },
                Unit.INCH
            );
        });

        it('should restore state with selectedRapidId and highlightedRapidId', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
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
                        selected: ['rapid-1'],
                        highlighted: 'rapid-2',
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
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(selectionStore.selectRapids).toHaveBeenCalledWith(
                new Set(['rapid-1'])
            );
            expect(selectionStore.highlightRapid).toHaveBeenCalledWith(
                'rapid-2'
            );
        });

        it('should show tool table when showToolTable is true', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: true,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(uiStore.showToolTable).toHaveBeenCalled();
            expect(uiStore.hideToolTable).not.toHaveBeenCalled();
        });

        it('should restore active tessellation with points', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: false,
                tessellationActive: true,
                tessellationPoints: [
                    { x: 0, y: 0, shapeId: 'shape1', chainId: 'chain1' },
                    { x: 10, y: 10, shapeId: 'shape2', chainId: 'chain2' },
                ],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(tessellationStore.setTessellation).toHaveBeenCalledWith([
                { x: 0, y: 0, shapeId: 'shape1', chainId: 'chain1' },
                { x: 10, y: 10, shapeId: 'shape2', chainId: 'chain2' },
            ]);
        });

        it('should restore overlay data with shape points', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    import: {
                        stage: WorkflowStage.IMPORT,
                        shapePoints: [
                            { x: 0, y: 0, type: 'origin', shapeId: 'shape1' },
                        ],
                        chainEndpoints: [],
                        tessellationPoints: [],
                        toolHead: undefined,
                    },
                },
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(overlayStore.setShapePoints).toHaveBeenCalledWith('import', [
                { x: 0, y: 0, type: 'origin', shapeId: 'shape1' },
            ]);
        });

        it('should restore overlay data with chain endpoints', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    prepare: {
                        stage: WorkflowStage.PROGRAM,
                        shapePoints: [],
                        chainEndpoints: [
                            { x: 5, y: 5, type: 'start', chainId: 'chain1' },
                        ],
                        tessellationPoints: [],
                        toolHead: undefined,
                    },
                },
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(overlayStore.setChainEndpoints).toHaveBeenCalledWith(
                'prepare',
                [{ x: 5, y: 5, type: 'start', chainId: 'chain1' }]
            );
        });

        it('should restore overlay data with tessellation points', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    edit: {
                        stage: WorkflowStage.PROGRAM,
                        shapePoints: [],
                        chainEndpoints: [],
                        tessellationPoints: [
                            {
                                x: 2,
                                y: 2,
                                shapeId: 'shape1',
                                chainId: 'chain1',
                            },
                        ],
                        toolHead: undefined,
                    },
                },
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(overlayStore.setTessellationPoints).toHaveBeenCalledWith(
                'edit',
                [{ x: 2, y: 2, shapeId: 'shape1', chainId: 'chain1' }]
            );
        });

        it('should restore overlay data with tool head', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                parts: [],
                partWarnings: [],
                showRapids: false,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    simulate: {
                        stage: WorkflowStage.SIMULATE,
                        shapePoints: [],
                        chainEndpoints: [],
                        tessellationPoints: [],
                        toolHead: { x: 100, y: 100, visible: true },
                    },
                },
                operations: [],
                cuts: [],
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();

            expect(overlayStore.setToolHead).toHaveBeenCalledWith('simulate', {
                x: 100,
                y: 100,
                visible: true,
            });
        });

        it.skip('should restore algorithm params with chainDetection', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();
        });

        it.skip('should restore algorithm params with chainNormalization', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();
        });

        it.skip('should restore algorithm params with partDetection', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();
        });

        it.skip('should restore algorithm params with joinColinearLines', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);

            restoreApplicationState();
        });

        it.skip('should handle errors when restoring state', () => {
            // NOTE: This test needs to be updated for the new layer-based chain system
            // where chainStore.setChains() no longer exists
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selection: {
                    shapes: {
                        selected: [],
                        hovered: null,
                        selectedOffset: null,
                    },
                    chains: { selected: [], highlighted: null },
                    parts: { selected: [], highlighted: null, hovered: null },
                    cuts: { selected: [], highlighted: null },
                    rapids: { selected: [], highlighted: null },
                    leads: { selected: [], highlighted: null },
                    kerfs: { selected: null, highlighted: null },
                },
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
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
                showCutNormals: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
                showCutTangentLines: false,
                tools: [],
                applicationSettings: defaultApplicationSettings,
                savedAt: new Date().toISOString(),
            };

            vi.mocked(localStorage.loadState).mockReturnValue(mockState);
            // Mock an error in the drawing store instead
            vi.spyOn(drawingStore, 'restoreDrawing').mockImplementation(() => {
                throw new Error('Test error');
            });

            const result = restoreApplicationState();

            expect(result).toBe(true); // Still returns true even if error occurs
        });
    });

    describe('clearApplicationState', () => {
        it('should call clearPersistedState', () => {
            clearApplicationState();

            expect(localStorage.clearPersistedState).toHaveBeenCalled();
        });
    });

    describe('setupAutoSave', () => {
        it('should set up subscriptions and return cleanup function', () => {
            const cleanup = setupAutoSave();

            // Call the cleanup function
            cleanup();
            // Verify cleanup runs without error
            expect(typeof cleanup).toBe('function');
        });
    });
});
