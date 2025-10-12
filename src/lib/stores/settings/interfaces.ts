/**
 * Application Settings Store Interfaces
 *
 * Type definitions for global application settings including measurement systems.
 */

import type { WorkflowStage } from '$lib/stores/workflow/enums';

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
    TravelingSalesman = 'traveling-salesman',
}

/**
 * Optimization settings interface
 */
export interface OptimizationSettings {
    /** When true, cut all holes before any shells */
    cutHolesFirst: boolean;

    /** Algorithm to use for rapid movement optimization */
    rapidOptimizationAlgorithm: RapidOptimizationAlgorithm;
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

    /** Update all settings at once */
    updateSettings: (settings: Partial<ApplicationSettings>) => void;

    /** Reset settings to defaults */
    resetToDefaults: () => void;
}
