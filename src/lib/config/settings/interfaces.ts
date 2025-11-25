import type { CutterCompensation } from '$lib/cam/gcode/enums';
import type {
    RapidOptimizationAlgorithm,
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    PreprocessingStep,
    OffsetImplementation,
} from './enums';
import type { WorkflowStage } from '$lib/stores/workflow/enums';

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

    /** When true, attempt to adjust cut start points to avoid lead kerf overlap */
    avoidLeadKerfOverlap: boolean;
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
