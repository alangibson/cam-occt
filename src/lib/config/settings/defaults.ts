import { DEFAULT_RAPID_RATE_MM } from '$lib/cam/constants';
import { CutterCompensation } from '$lib/cam/gcode/enums';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import {
    RapidOptimizationAlgorithm,
    MeasurementSystem as MS,
    ImportUnitSetting as IUS,
    SelectionMode as SM,
    PreprocessingStep,
    OffsetImplementation,
} from './enums';
import type {
    CamSettings,
    OptimizationSettings,
    ApplicationSettings,
} from './interfaces';

// Default CAM settings - use metric default, will be converted if needed when measurement system is set
export const DEFAULT_CAM_SETTINGS: CamSettings = {
    rapidRate: DEFAULT_RAPID_RATE_MM,
    cutterCompensation: CutterCompensation.SOFTWARE,
};
// Default optimization settings
export const DEFAULT_OPTIMIZATION_SETTINGS: OptimizationSettings = {
    cutHolesFirst: true,
    rapidOptimizationAlgorithm: RapidOptimizationAlgorithm.TravelingSalesman,
    zoomToFit: true,
    avoidLeadKerfOverlap: false,
};
// Default application settings
export const DEFAULT_SETTINGS: ApplicationSettings = {
    measurementSystem: MS.Metric,
    importUnitSetting: IUS.Automatic,
    selectionMode: SM.Auto,
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
    optimizationSettings: DEFAULT_OPTIMIZATION_SETTINGS,
    offsetImplementation: OffsetImplementation.Polyline,
    camSettings: DEFAULT_CAM_SETTINGS,
};
