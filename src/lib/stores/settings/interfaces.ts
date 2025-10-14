/**
 * Application Settings Store Interfaces
 *
 * Type definitions for global application settings including measurement systems.
 */

import type { WorkflowStage } from '$lib/stores/workflow/enums';
import type { CutterCompensation } from '$lib/types/cam';

/**
 * Application measurement system options
 */
export enum MeasurementSystem {
    Metric = 'metric',
    Imperial = 'imperial',
}

/**
 * Import unit preference options
 */
export enum ImportUnitSetting {
    Automatic = 'automatic', // Use file's units, fall back to application setting if not specified
    Application = 'application', // Always use application's measurement system
    Metric = 'metric', // Force metric units during import
    Imperial = 'imperial', // Force imperial units during import
}

/**
 * Selection mode options for canvas interaction
 */
export enum SelectionMode {
    Auto = 'auto', // Stage-dependent selection (default)
    Chain = 'chain', // Only chains can be selected/hovered
    Shape = 'shape', // Only individual shapes can be selected/hovered
    Part = 'part', // Only parts can be selected/hovered
    Cut = 'cut', // Only cuts can be selected/hovered
    Lead = 'lead', // Only leads can be selected/hovered
}

/**
 * Preprocessing step identifiers
 */
export enum PreprocessingStep {
    DecomposePolylines = 'decomposePolylines',
    JoinColinearLines = 'joinColinearLines',
    TranslateToPositive = 'translateToPositive',
    DetectChains = 'detectChains',
    NormalizeChains = 'normalizeChains',
    OptimizeStarts = 'optimizeStarts',
    DetectParts = 'detectParts',
}

/**
 * Rapid optimization algorithm options
 */
export enum RapidOptimizationAlgorithm {
    None = 'none',
    TravelingSalesman = 'traveling-salesman',
}

/**
 * Offset calculation implementation options
 */
export enum OffsetImplementation {
    Exact = 'exact', // Existing TypeScript implementation (preserves curves)
    Polyline = 'polyline', // Clipper2 WASM implementation (tessellates to polylines)
}

/**
 * CAM settings interface
 */
export interface CamSettings {
    /** Rapid feed rate in units/min (units depend on measurement system) */
    rapidRate: number;
    /** Cutter compensation mode for G-code generation */
    cutterCompensation: CutterCompensation | null;
}

/**
 * Optimization settings interface
 */
export interface OptimizationSettings {
    /** When true, cut all holes before any shells */
    cutHolesFirst: boolean;

    /** Algorithm to use for rapid movement optimization */
    rapidOptimizationAlgorithm: RapidOptimizationAlgorithm;

    /** When true, automatically zoom to fit when entering the Program stage */
    zoomToFit: boolean;
}

/**
 * Application settings interface
 */
export interface ApplicationSettings {
    /** Global measurement system for the application */
    measurementSystem: MeasurementSystem;

    /** Default behavior for import unit handling */
    importUnitSetting: ImportUnitSetting;

    /** Selection mode for canvas interaction */
    selectionMode: SelectionMode;

    /** Workflow stages that are enabled */
    enabledStages: WorkflowStage[];

    /** Preprocessing steps that are enabled */
    enabledPreprocessingSteps: PreprocessingStep[];

    /** Optimization settings */
    optimizationSettings: OptimizationSettings;

    /** Offset calculation implementation to use */
    offsetImplementation: OffsetImplementation;

    /** CAM settings */
    camSettings: CamSettings;
}

/**
 * Settings store state interface
 */
export interface SettingsState {
    settings: ApplicationSettings;
}

/**
 * Settings store interface
 */
export interface SettingsStore {
    subscribe: (run: (value: SettingsState) => void) => () => void;

    /** Update the application measurement system */
    setMeasurementSystem: (system: MeasurementSystem) => void;

    /** Update the import unit setting */
    setImportUnitSetting: (setting: ImportUnitSetting) => void;

    /** Update the selection mode */
    setSelectionMode: (mode: SelectionMode) => void;

    /** Toggle a workflow stage enabled/disabled */
    toggleStageEnabled: (stage: WorkflowStage) => void;

    /** Set a workflow stage enabled/disabled */
    setStageEnabled: (stage: WorkflowStage, enabled: boolean) => void;

    /** Toggle a preprocessing step enabled/disabled */
    togglePreprocessingStepEnabled: (step: PreprocessingStep) => void;

    /** Set a preprocessing step enabled/disabled */
    setPreprocessingStepEnabled: (
        step: PreprocessingStep,
        enabled: boolean
    ) => void;

    /** Set whether to cut holes first */
    setCutHolesFirst: (enabled: boolean) => void;

    /** Set the rapid optimization algorithm */
    setRapidOptimizationAlgorithm: (
        algorithm: RapidOptimizationAlgorithm
    ) => void;

    /** Set whether to automatically zoom to fit on Program stage */
    setZoomToFit: (enabled: boolean) => void;

    /** Set the offset implementation */
    setOffsetImplementation: (implementation: OffsetImplementation) => void;

    /** Set the rapid rate */
    setRapidRate: (rate: number) => void;

    /** Set the cutter compensation mode */
    setCutterCompensation: (mode: CutterCompensation | null) => void;

    /** Update all settings at once */
    updateSettings: (settings: Partial<ApplicationSettings>) => void;

    /** Reset settings to defaults */
    resetToDefaults: () => void;
}
