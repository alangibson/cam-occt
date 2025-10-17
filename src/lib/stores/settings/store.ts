/**
 * Application Settings Store
 *
 * Manages global application settings including measurement systems and import preferences.
 * Settings are persisted to localStorage and restored on application startup.
 */

import { writable } from 'svelte/store';
import type {
    ApplicationSettings,
    SettingsState,
    SettingsStore,
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
    OptimizationSettings,
    CamSettings,
} from './interfaces';
import {
    MeasurementSystem as MS,
    ImportUnitSetting as IUS,
    SelectionMode as SM,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
} from './interfaces';
import { DefaultsManager } from '$lib/config/defaults-manager';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { DEFAULT_RAPID_RATE_MM } from '$lib/cam/constants';
import { CutterCompensation } from '$lib/cam/cut-generator/enums';

// Conversion factor between inches and millimeters
const MM_PER_INCH = 25.4;

// Default CAM settings - use metric default, will be converted if needed when measurement system is set
const DEFAULT_CAM_SETTINGS: CamSettings = {
    rapidRate: DEFAULT_RAPID_RATE_MM,
    cutterCompensation: CutterCompensation.SOFTWARE,
};

// Default optimization settings
const DEFAULT_OPTIMIZATION_SETTINGS: OptimizationSettings = {
    cutHolesFirst: true,
    rapidOptimizationAlgorithm: RapidOptimizationAlgorithm.TravelingSalesman,
    zoomToFit: true,
};

// Default application settings
const DEFAULT_SETTINGS: ApplicationSettings = {
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
        PreprocessingStep.TranslateToPositive,
        PreprocessingStep.DetectChains,
        PreprocessingStep.NormalizeChains,
        PreprocessingStep.DetectParts,
    ],
    optimizationSettings: DEFAULT_OPTIMIZATION_SETTINGS,
    offsetImplementation: OffsetImplementation.Polyline,
    camSettings: DEFAULT_CAM_SETTINGS,
};

// localStorage key for settings persistence
const SETTINGS_STORAGE_KEY = 'metalhead-cam-settings';

/**
 * Load settings from localStorage or return defaults
 */
function loadSettings(): ApplicationSettings {
    try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);

            // Validate the loaded settings structure
            if (parsed && typeof parsed === 'object') {
                // Validate optimization settings
                const optimizationSettings: OptimizationSettings =
                    parsed.optimizationSettings &&
                    typeof parsed.optimizationSettings === 'object'
                        ? {
                              cutHolesFirst:
                                  typeof parsed.optimizationSettings
                                      .cutHolesFirst === 'boolean'
                                      ? parsed.optimizationSettings
                                            .cutHolesFirst
                                      : DEFAULT_OPTIMIZATION_SETTINGS.cutHolesFirst,
                              rapidOptimizationAlgorithm: Object.values(
                                  RapidOptimizationAlgorithm
                              ).includes(
                                  parsed.optimizationSettings
                                      .rapidOptimizationAlgorithm
                              )
                                  ? parsed.optimizationSettings
                                        .rapidOptimizationAlgorithm
                                  : DEFAULT_OPTIMIZATION_SETTINGS.rapidOptimizationAlgorithm,
                              zoomToFit:
                                  typeof parsed.optimizationSettings
                                      .zoomToFit === 'boolean'
                                      ? parsed.optimizationSettings.zoomToFit
                                      : DEFAULT_OPTIMIZATION_SETTINGS.zoomToFit,
                          }
                        : DEFAULT_OPTIMIZATION_SETTINGS;

                // Validate CAM settings
                const camSettings: CamSettings =
                    parsed.camSettings && typeof parsed.camSettings === 'object'
                        ? {
                              rapidRate:
                                  typeof parsed.camSettings.rapidRate ===
                                      'number' &&
                                  parsed.camSettings.rapidRate > 0
                                      ? parsed.camSettings.rapidRate
                                      : DEFAULT_CAM_SETTINGS.rapidRate,
                              cutterCompensation:
                                  parsed.camSettings.cutterCompensation ===
                                      null ||
                                  Object.values(CutterCompensation).includes(
                                      parsed.camSettings.cutterCompensation
                                  )
                                      ? parsed.camSettings.cutterCompensation
                                      : DEFAULT_CAM_SETTINGS.cutterCompensation,
                          }
                        : DEFAULT_CAM_SETTINGS;

                return {
                    measurementSystem: Object.values(MS).includes(
                        parsed.measurementSystem
                    )
                        ? parsed.measurementSystem
                        : DEFAULT_SETTINGS.measurementSystem,
                    importUnitSetting: Object.values(IUS).includes(
                        parsed.importUnitSetting
                    )
                        ? parsed.importUnitSetting
                        : DEFAULT_SETTINGS.importUnitSetting,
                    selectionMode: Object.values(SM).includes(
                        parsed.selectionMode
                    )
                        ? parsed.selectionMode
                        : DEFAULT_SETTINGS.selectionMode,
                    enabledStages: Array.isArray(parsed.enabledStages)
                        ? parsed.enabledStages.filter((s: string) =>
                              Object.values(WorkflowStage).includes(
                                  s as WorkflowStage
                              )
                          )
                        : DEFAULT_SETTINGS.enabledStages,
                    enabledPreprocessingSteps: Array.isArray(
                        parsed.enabledPreprocessingSteps
                    )
                        ? parsed.enabledPreprocessingSteps.filter((s: string) =>
                              Object.values(PreprocessingStep).includes(
                                  s as PreprocessingStep
                              )
                          )
                        : DEFAULT_SETTINGS.enabledPreprocessingSteps,
                    optimizationSettings,
                    offsetImplementation: Object.values(
                        OffsetImplementation
                    ).includes(parsed.offsetImplementation)
                        ? parsed.offsetImplementation
                        : DEFAULT_SETTINGS.offsetImplementation,
                    camSettings,
                };
            }
        }
    } catch (error) {
        console.warn('Failed to load settings from localStorage:', error);
    }

    return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: ApplicationSettings): void {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
    }
}

/**
 * Create the settings store
 */
function createSettingsStore(): SettingsStore {
    const initialState: SettingsState = {
        settings: loadSettings(),
    };

    const { subscribe, update } = writable<SettingsState>(initialState);

    return {
        subscribe,

        setMeasurementSystem(system: MeasurementSystem) {
            update((state) => {
                const oldSystem = state.settings.measurementSystem;

                // Convert rapid rate when measurement system changes
                let newRapidRate = state.settings.camSettings.rapidRate;
                if (oldSystem !== system) {
                    if (oldSystem === MS.Metric && system === MS.Imperial) {
                        // Convert mm/min to in/min
                        newRapidRate = newRapidRate / MM_PER_INCH;
                    } else if (
                        oldSystem === MS.Imperial &&
                        system === MS.Metric
                    ) {
                        // Convert in/min to mm/min
                        newRapidRate = newRapidRate * MM_PER_INCH;
                    }
                }

                const newSettings = {
                    ...state.settings,
                    measurementSystem: system,
                    camSettings: {
                        ...state.settings.camSettings,
                        rapidRate: newRapidRate,
                    },
                };
                saveSettings(newSettings);

                // Update the defaults manager with the new measurement system
                DefaultsManager.getInstance().updateMeasurementSystem(system);

                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setImportUnitSetting(setting: ImportUnitSetting) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    importUnitSetting: setting,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setSelectionMode(mode: SelectionMode) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    selectionMode: mode,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        toggleStageEnabled(stage: WorkflowStage) {
            update((state) => {
                // Import stage cannot be disabled
                if (stage === WorkflowStage.IMPORT) {
                    return state;
                }

                const currentEnabled = state.settings.enabledStages;
                const isEnabled = currentEnabled.includes(stage);

                const newEnabledStages = isEnabled
                    ? currentEnabled.filter((s) => s !== stage)
                    : [...currentEnabled, stage];

                const newSettings = {
                    ...state.settings,
                    enabledStages: newEnabledStages,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setStageEnabled(stage: WorkflowStage, enabled: boolean) {
            update((state) => {
                // Import stage cannot be disabled
                if (stage === WorkflowStage.IMPORT && !enabled) {
                    return state;
                }

                const currentEnabled = state.settings.enabledStages;
                const isCurrentlyEnabled = currentEnabled.includes(stage);

                let newEnabledStages = currentEnabled;

                if (enabled && !isCurrentlyEnabled) {
                    newEnabledStages = [...currentEnabled, stage];
                } else if (!enabled && isCurrentlyEnabled) {
                    newEnabledStages = currentEnabled.filter(
                        (s) => s !== stage
                    );
                }

                const newSettings = {
                    ...state.settings,
                    enabledStages: newEnabledStages,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        togglePreprocessingStepEnabled(step: PreprocessingStep) {
            update((state) => {
                const currentEnabled = state.settings.enabledPreprocessingSteps;
                const isEnabled = currentEnabled.includes(step);

                const newEnabledSteps = isEnabled
                    ? currentEnabled.filter((s) => s !== step)
                    : [...currentEnabled, step];

                const newSettings = {
                    ...state.settings,
                    enabledPreprocessingSteps: newEnabledSteps,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setPreprocessingStepEnabled(step: PreprocessingStep, enabled: boolean) {
            update((state) => {
                const currentEnabled = state.settings.enabledPreprocessingSteps;
                const isCurrentlyEnabled = currentEnabled.includes(step);

                let newEnabledSteps = currentEnabled;

                if (enabled && !isCurrentlyEnabled) {
                    newEnabledSteps = [...currentEnabled, step];
                } else if (!enabled && isCurrentlyEnabled) {
                    newEnabledSteps = currentEnabled.filter((s) => s !== step);
                }

                const newSettings = {
                    ...state.settings,
                    enabledPreprocessingSteps: newEnabledSteps,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setCutHolesFirst(enabled: boolean) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    optimizationSettings: {
                        ...state.settings.optimizationSettings,
                        cutHolesFirst: enabled,
                    },
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setRapidOptimizationAlgorithm(algorithm: RapidOptimizationAlgorithm) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    optimizationSettings: {
                        ...state.settings.optimizationSettings,
                        rapidOptimizationAlgorithm: algorithm,
                    },
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setZoomToFit(enabled: boolean) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    optimizationSettings: {
                        ...state.settings.optimizationSettings,
                        zoomToFit: enabled,
                    },
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setOffsetImplementation(implementation: OffsetImplementation) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    offsetImplementation: implementation,
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setRapidRate(rate: number) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    camSettings: {
                        ...state.settings.camSettings,
                        rapidRate: rate,
                    },
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        setCutterCompensation(mode: CutterCompensation | null) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    camSettings: {
                        ...state.settings.camSettings,
                        cutterCompensation: mode,
                    },
                };
                saveSettings(newSettings);
                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        updateSettings(partialSettings: Partial<ApplicationSettings>) {
            update((state) => {
                const newSettings = {
                    ...state.settings,
                    ...partialSettings,
                };
                saveSettings(newSettings);

                // Update the defaults manager if measurement system changed
                if (partialSettings.measurementSystem !== undefined) {
                    DefaultsManager.getInstance().updateMeasurementSystem(
                        partialSettings.measurementSystem
                    );
                }

                return {
                    ...state,
                    settings: newSettings,
                };
            });
        },

        resetToDefaults() {
            update((state) => {
                saveSettings(DEFAULT_SETTINGS);

                // Update the defaults manager with default measurement system
                DefaultsManager.getInstance().updateMeasurementSystem(
                    DEFAULT_SETTINGS.measurementSystem
                );

                return {
                    ...state,
                    settings: { ...DEFAULT_SETTINGS },
                };
            });
        },
    };
}

// Export the settings store instance
export const settingsStore = createSettingsStore();

// Note: DefaultsManager initializes itself from settingsStore in its constructor
// No need for explicit initialization here
