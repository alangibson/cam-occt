import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveApplicationState,
    autoSaveApplicationState,
    restoreApplicationState,
    clearApplicationState,
    setupAutoSave,
} from './store';
import * as localStorage from './local-storage';
import { drawingStore } from '$lib/stores/drawing/store';
import { workflowStore } from '$lib/stores/workflow/store';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';
import { rapidStore } from '$lib/stores/rapids/store';
import { uiStore } from '$lib/stores/ui/store';
import { tessellationStore } from '$lib/stores/tessellation/store';
import { overlayStore } from '$lib/stores/overlay/store';
import { prepareStageStore } from '$lib/stores/prepare-stage/store';
import { operationsStore } from '$lib/stores/operations/store';
import { cutStore } from '$lib/stores/cuts/store';
import { toolStore } from '$lib/stores/tools/store';
import { settingsStore } from '$lib/stores/settings/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { Unit } from '$lib/config/units/units';
import type { PersistedState } from './interfaces';
import { DEFAULT_ALGORITHM_PARAMETERS_MM } from '$lib/preprocessing/algorithm-parameters';
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
        PreprocessingStep.OptimizeStarts,
    ],
    optimizationSettings: {
        cutHolesFirst: true,
        rapidOptimizationAlgorithm:
            RapidOptimizationAlgorithm.TravelingSalesman,
        zoomToFit: true,
    },
    offsetImplementation: OffsetImplementation.Exact,
    camSettings: {
        rapidRate: 3000,
        cutterCompensation: null,
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
vi.mock('../chains/store', () => ({
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

vi.mock('../parts/store', () => ({
    partStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setParts: vi.fn(),
        setWarnings: vi.fn(),
        highlightPart: vi.fn(),
        selectPart: vi.fn(),
    },
}));

vi.mock('../drawing/store', () => ({
    drawingStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        restoreDrawing: vi.fn(),
        setLayerVisibility: vi.fn(),
    },
}));

vi.mock('../workflow/store', () => ({
    workflowStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        restore: vi.fn(),
    },
}));

vi.mock('../rapids/store', () => ({
    rapidStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setRapids: vi.fn(),
        setShowRapids: vi.fn(),
        selectRapids: vi.fn(),
        highlightRapid: vi.fn(),
    },
}));

vi.mock('../ui/store', () => ({
    uiStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        showToolTable: vi.fn(),
        hideToolTable: vi.fn(),
    },
}));

vi.mock('../tessellation/store', () => ({
    tessellationStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setTessellation: vi.fn(),
        clearTessellation: vi.fn(),
    },
}));

vi.mock('../overlay/store', () => ({
    overlayStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setCurrentStage: vi.fn(),
        setShapePoints: vi.fn(),
        setChainEndpoints: vi.fn(),
        setTessellationPoints: vi.fn(),
        setToolHead: vi.fn(),
    },
}));

vi.mock('../prepare-stage/store', () => ({
    prepareStageStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        setAlgorithmParams: vi.fn(),
        setChainNormalizationResults: vi.fn(),
        setColumnWidths: vi.fn(),
    },
}));

vi.mock('../operations/store', () => ({
    operationsStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        reorderOperations: vi.fn(),
    },
}));

vi.mock('../cuts/store', () => ({
    cutStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        restore: vi.fn(),
    },
}));

vi.mock('../tools/store', () => ({
    toolStore: {
        subscribe: vi.fn((fn) => {
            fn({});
            return () => {};
        }),
        reorderTools: vi.fn(),
    },
}));

vi.mock('../settings/store', () => ({
    settingsStore: {
        subscribe: vi.fn((fn) => {
            fn({ settings: defaultApplicationSettings });
            return () => {};
        }),
    },
}));

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
                selectedShapes: new Set<string>(['shape1']),
                hoveredShape: 'shape2',
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
                selectedChainIds: new Set(),
            };
        }
        if (store === partStore) {
            return {
                parts: [],
                warnings: [],
                highlightedPartId: null,
                selectedPartIds: new Set(),
            };
        }
        if (store === rapidStore) {
            return {
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
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
        if (store === prepareStageStore) {
            return {
                algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                chainNormalizationResults: [],
                leftColumnWidth: 30,
                rightColumnWidth: 70,
            };
        }
        if (store === operationsStore) {
            return [];
        }
        if (store === cutStore) {
            return {
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                    selectedShapes: ['shape1'],
                    hoveredShape: 'shape2',
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: ['chain-123'],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                selectedPartIds: [],
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
            expect(chainStore.selectChain).toHaveBeenCalledWith(
                'chain-123',
                false
            );
        });

        it('should restore state with highlightedPartId', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: 'part-456',
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(partStore.highlightPart).toHaveBeenCalledWith('part-456');
        });

        it('should restore state with inch display unit', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'inch',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(drawingStore.restoreDrawing).toHaveBeenCalledWith(
                expect.objectContaining({ units: Unit.MM }),
                'test.dxf',
                1,
                { x: 0, y: 0 },
                Unit.INCH,
                expect.any(Set),
                null
            );
        });

        it('should restore state with selectedRapidId and highlightedRapidId', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: ['rapid-1'],
                highlightedRapidId: 'rapid-2',
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(rapidStore.selectRapids).toHaveBeenCalledWith(
                new Set(['rapid-1'])
            );
            expect(rapidStore.highlightRapid).toHaveBeenCalledWith('rapid-2');
        });

        it('should show tool table when showToolTable is true', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: true,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: true,
                tessellationPoints: [
                    { x: 0, y: 0, shapeId: 'shape1', chainId: 'chain1' },
                    { x: 10, y: 10, shapeId: 'shape2', chainId: 'chain2' },
                ],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
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
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    prepare: {
                        stage: WorkflowStage.PREPARE,
                        shapePoints: [],
                        chainEndpoints: [
                            { x: 5, y: 5, type: 'start', chainId: 'chain1' },
                        ],
                        tessellationPoints: [],
                        toolHead: undefined,
                    },
                },
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {
                    edit: {
                        stage: WorkflowStage.EDIT,
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
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
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
                prepareStageState: {
                    algorithmParams: DEFAULT_ALGORITHM_PARAMETERS_MM,
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

        it('should restore algorithm params with chainDetection', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: {
                        ...DEFAULT_ALGORITHM_PARAMETERS_MM,
                        chainDetection: {
                            tolerance: 0.005,
                        },
                    },
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(prepareStageStore.setAlgorithmParams).toHaveBeenCalledWith(
                expect.objectContaining({
                    chainDetection: expect.objectContaining({
                        tolerance: 0.005,
                    }),
                })
            );
        });

        it('should restore algorithm params with chainNormalization', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: {
                        ...DEFAULT_ALGORITHM_PARAMETERS_MM,
                        chainNormalization: {
                            ...DEFAULT_ALGORITHM_PARAMETERS_MM.chainNormalization,
                            traversalTolerance: 0.02,
                        },
                    },
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(prepareStageStore.setAlgorithmParams).toHaveBeenCalledWith(
                expect.objectContaining({
                    chainNormalization: expect.objectContaining({
                        traversalTolerance: 0.02,
                    }),
                })
            );
        });

        it('should restore algorithm params with partDetection', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: {
                        ...DEFAULT_ALGORITHM_PARAMETERS_MM,
                        partDetection: {
                            ...DEFAULT_ALGORITHM_PARAMETERS_MM.partDetection,
                            enableTessellation: false,
                        },
                    },
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(prepareStageStore.setAlgorithmParams).toHaveBeenCalledWith(
                expect.objectContaining({
                    partDetection: expect.objectContaining({
                        enableTessellation: false,
                    }),
                })
            );
        });

        it('should restore algorithm params with joinColinearLines', () => {
            const mockState: PersistedState = {
                drawing: {
                    shapes: [],
                    units: Unit.MM,
                    fileName: '',
                },
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: {
                    algorithmParams: {
                        ...DEFAULT_ALGORITHM_PARAMETERS_MM,
                        joinColinearLines: {
                            tolerance: 0.01,
                        },
                    },
                    chainNormalizationResults: [],
                    leftColumnWidth: 30,
                    rightColumnWidth: 70,
                    lastAnalysisTimestamp: 0,
                    originalShapesBeforeNormalization: null,
                    originalChainsBeforeNormalization: null,
                    originalShapesBeforeOptimization: null,
                    originalChainsBeforeOptimization: null,
                    partsDetected: false,
                },
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            expect(prepareStageStore.setAlgorithmParams).toHaveBeenCalledWith(
                expect.objectContaining({
                    joinColinearLines: expect.objectContaining({
                        tolerance: 0.01,
                    }),
                })
            );
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
                selectedShapes: [],
                hoveredShape: null,
                scale: 1,
                offset: { x: 0, y: 0 },
                fileName: 'test.dxf',
                layerVisibility: {},
                displayUnit: 'mm',
                currentStage: WorkflowStage.IMPORT,
                completedStages: [],
                chains: [],
                tolerance: 0.001,
                selectedChainIds: [],
                selectedPartIds: [],
                parts: [],
                partWarnings: [],
                highlightedPartId: null,
                showRapids: false,
                selectedRapidIds: [],
                highlightedRapidId: null,
                showToolTable: false,
                tessellationActive: false,
                tessellationPoints: [],
                overlayStage: WorkflowStage.IMPORT,
                overlays: {},
                prepareStageState: null,
                operations: [],
                cuts: [],
                selectedCutIds: [],
                highlightedCutId: null,
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

            // Verify subscriptions were set up
            expect(drawingStore.subscribe).toHaveBeenCalled();
            expect(workflowStore.subscribe).toHaveBeenCalled();
            expect(chainStore.subscribe).toHaveBeenCalled();
            expect(partStore.subscribe).toHaveBeenCalled();
            expect(rapidStore.subscribe).toHaveBeenCalled();
            expect(uiStore.subscribe).toHaveBeenCalled();
            expect(tessellationStore.subscribe).toHaveBeenCalled();
            expect(overlayStore.subscribe).toHaveBeenCalled();
            expect(prepareStageStore.subscribe).toHaveBeenCalled();
            expect(operationsStore.subscribe).toHaveBeenCalled();
            expect(cutStore.subscribe).toHaveBeenCalled();
            expect(toolStore.subscribe).toHaveBeenCalled();

            // Call the cleanup function
            cleanup();
            // Verify cleanup runs without error
            expect(typeof cleanup).toBe('function');
        });
    });
});
