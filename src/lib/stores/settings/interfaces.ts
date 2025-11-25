/**
 * Application Settings Store Interfaces
 *
 * Type definitions for global application settings including measurement systems.
 */

import type { WorkflowStage } from '$lib/stores/workflow/enums';
import type { CutterCompensation } from '$lib/cam/gcode/enums';
import type {
    SettingsState,
    ApplicationSettings,
} from '$lib/config/settings/interfaces';
import type {
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
} from '$lib/config/settings/enums';

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

    /** Set whether to avoid lead kerf overlap */
    setAvoidLeadKerfOverlap: (enabled: boolean) => void;

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
