/**
 * Application Settings Store
 *
 * Manages global application settings including measurement systems and import preferences.
 * Settings are persisted to localStorage and restored on application startup.
 */

import type {
    MeasurementSystem,
    ImportUnitSetting,
    SelectionMode,
} from '$lib/config/settings/enums';
import type {
    ApplicationSettings,
    OptimizationSettings,
    CamSettings,
} from '$lib/config/settings/interfaces';
import {
    MeasurementSystem as MS,
    ImportUnitSetting as IUS,
    SelectionMode as SM,
    PreprocessingStep,
    RapidOptimizationAlgorithm,
    OffsetImplementation,
    Renderer,
} from '$lib/config/settings/enums';
import { DefaultsManager } from '$lib/config/defaults/defaults-manager';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { CutterCompensation } from '$lib/cam/gcode/enums';
import { MM_PER_INCH } from '$lib/config/units/units';
import {
    DEFAULT_OPTIMIZATION_SETTINGS,
    DEFAULT_CAM_SETTINGS,
    DEFAULT_SETTINGS,
} from '$lib/config/settings/defaults';
import { SETTINGS_STORAGE_KEY } from './constants';

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
                              avoidLeadKerfOverlap:
                                  typeof parsed.optimizationSettings
                                      .avoidLeadKerfOverlap === 'boolean'
                                      ? parsed.optimizationSettings
                                            .avoidLeadKerfOverlap
                                      : DEFAULT_OPTIMIZATION_SETTINGS.avoidLeadKerfOverlap,
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
                    enabledProgramSteps: Array.isArray(
                        parsed.enabledProgramSteps
                    )
                        ? parsed.enabledProgramSteps.filter((s: string) =>
                              Object.values(PreprocessingStep).includes(
                                  s as PreprocessingStep
                              )
                          )
                        : DEFAULT_SETTINGS.enabledProgramSteps,
                    optimizationSettings,
                    offsetImplementation: Object.values(
                        OffsetImplementation
                    ).includes(parsed.offsetImplementation)
                        ? parsed.offsetImplementation
                        : DEFAULT_SETTINGS.offsetImplementation,
                    renderer: Object.values(Renderer).includes(parsed.renderer)
                        ? parsed.renderer
                        : DEFAULT_SETTINGS.renderer,
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
 * Settings store class using Svelte 5 runes
 */
class SettingsStore {
    settings = $state<ApplicationSettings>(loadSettings());

    setMeasurementSystem(system: MeasurementSystem) {
        const oldSystem = this.settings.measurementSystem;

        // Convert rapid rate when measurement system changes
        let newRapidRate = this.settings.camSettings.rapidRate;
        if (oldSystem !== system) {
            if (oldSystem === MS.Metric && system === MS.Imperial) {
                // Convert mm/min to in/min
                newRapidRate = newRapidRate / MM_PER_INCH;
            } else if (oldSystem === MS.Imperial && system === MS.Metric) {
                // Convert in/min to mm/min
                newRapidRate = newRapidRate * MM_PER_INCH;
            }
        }

        this.settings = {
            ...this.settings,
            measurementSystem: system,
            camSettings: {
                ...this.settings.camSettings,
                rapidRate: newRapidRate,
            },
        };
        saveSettings(this.settings);

        // Update the defaults manager with the new measurement system
        DefaultsManager.getInstance().updateMeasurementSystem(system);
    }

    setImportUnitSetting(setting: ImportUnitSetting) {
        this.settings = {
            ...this.settings,
            importUnitSetting: setting,
        };
        saveSettings(this.settings);
    }

    setSelectionMode(mode: SelectionMode) {
        this.settings = {
            ...this.settings,
            selectionMode: mode,
        };
        saveSettings(this.settings);
    }

    toggleStageEnabled(stage: WorkflowStage) {
        // Import stage cannot be disabled
        if (stage === WorkflowStage.IMPORT) {
            return;
        }

        const currentEnabled = this.settings.enabledStages;
        const isEnabled = currentEnabled.includes(stage);

        const newEnabledStages = isEnabled
            ? currentEnabled.filter((s) => s !== stage)
            : [...currentEnabled, stage];

        this.settings = {
            ...this.settings,
            enabledStages: newEnabledStages,
        };
        saveSettings(this.settings);
    }

    setStageEnabled(stage: WorkflowStage, enabled: boolean) {
        // Import stage cannot be disabled
        if (stage === WorkflowStage.IMPORT && !enabled) {
            return;
        }

        const currentEnabled = this.settings.enabledStages;
        const isCurrentlyEnabled = currentEnabled.includes(stage);

        let newEnabledStages = currentEnabled;

        if (enabled && !isCurrentlyEnabled) {
            newEnabledStages = [...currentEnabled, stage];
        } else if (!enabled && isCurrentlyEnabled) {
            newEnabledStages = currentEnabled.filter((s) => s !== stage);
        }

        this.settings = {
            ...this.settings,
            enabledStages: newEnabledStages,
        };
        saveSettings(this.settings);
    }

    togglePreprocessingStepEnabled(step: PreprocessingStep) {
        const currentEnabled = this.settings.enabledPreprocessingSteps;
        const isEnabled = currentEnabled.includes(step);

        const newEnabledSteps = isEnabled
            ? currentEnabled.filter((s) => s !== step)
            : [...currentEnabled, step];

        this.settings = {
            ...this.settings,
            enabledPreprocessingSteps: newEnabledSteps,
        };
        saveSettings(this.settings);
    }

    setPreprocessingStepEnabled(step: PreprocessingStep, enabled: boolean) {
        const currentEnabled = this.settings.enabledPreprocessingSteps;
        const isCurrentlyEnabled = currentEnabled.includes(step);

        let newEnabledSteps = currentEnabled;

        if (enabled && !isCurrentlyEnabled) {
            newEnabledSteps = [...currentEnabled, step];
        } else if (!enabled && isCurrentlyEnabled) {
            newEnabledSteps = currentEnabled.filter((s) => s !== step);
        }

        this.settings = {
            ...this.settings,
            enabledPreprocessingSteps: newEnabledSteps,
        };
        saveSettings(this.settings);
    }

    toggleProgramStepEnabled(step: PreprocessingStep) {
        const currentEnabled = this.settings.enabledProgramSteps;
        const isEnabled = currentEnabled.includes(step);

        const newEnabledSteps = isEnabled
            ? currentEnabled.filter((s) => s !== step)
            : [...currentEnabled, step];

        this.settings = {
            ...this.settings,
            enabledProgramSteps: newEnabledSteps,
        };
        saveSettings(this.settings);
    }

    setProgramStepEnabled(step: PreprocessingStep, enabled: boolean) {
        const currentEnabled = this.settings.enabledProgramSteps;
        const isCurrentlyEnabled = currentEnabled.includes(step);

        let newEnabledSteps = currentEnabled;

        if (enabled && !isCurrentlyEnabled) {
            newEnabledSteps = [...currentEnabled, step];
        } else if (!enabled && isCurrentlyEnabled) {
            newEnabledSteps = currentEnabled.filter((s) => s !== step);
        }

        this.settings = {
            ...this.settings,
            enabledProgramSteps: newEnabledSteps,
        };
        saveSettings(this.settings);
    }

    setCutHolesFirst(enabled: boolean) {
        this.settings = {
            ...this.settings,
            optimizationSettings: {
                ...this.settings.optimizationSettings,
                cutHolesFirst: enabled,
            },
        };
        saveSettings(this.settings);
    }

    setRapidOptimizationAlgorithm(algorithm: RapidOptimizationAlgorithm) {
        this.settings = {
            ...this.settings,
            optimizationSettings: {
                ...this.settings.optimizationSettings,
                rapidOptimizationAlgorithm: algorithm,
            },
        };
        saveSettings(this.settings);
    }

    setZoomToFit(enabled: boolean) {
        this.settings = {
            ...this.settings,
            optimizationSettings: {
                ...this.settings.optimizationSettings,
                zoomToFit: enabled,
            },
        };
        saveSettings(this.settings);
    }

    setAvoidLeadKerfOverlap(enabled: boolean) {
        this.settings = {
            ...this.settings,
            optimizationSettings: {
                ...this.settings.optimizationSettings,
                avoidLeadKerfOverlap: enabled,
            },
        };
        saveSettings(this.settings);
    }

    setOffsetImplementation(implementation: OffsetImplementation) {
        this.settings = {
            ...this.settings,
            offsetImplementation: implementation,
        };
        saveSettings(this.settings);
    }

    setRenderer(renderer: Renderer) {
        this.settings = {
            ...this.settings,
            renderer,
        };
        saveSettings(this.settings);
    }

    setRapidRate(rate: number) {
        this.settings = {
            ...this.settings,
            camSettings: {
                ...this.settings.camSettings,
                rapidRate: rate,
            },
        };
        saveSettings(this.settings);
    }

    setCutterCompensation(mode: CutterCompensation | null) {
        this.settings = {
            ...this.settings,
            camSettings: {
                ...this.settings.camSettings,
                cutterCompensation: mode,
            },
        };
        saveSettings(this.settings);
    }

    updateSettings(partialSettings: Partial<ApplicationSettings>) {
        this.settings = {
            ...this.settings,
            ...partialSettings,
        };
        saveSettings(this.settings);

        // Update the defaults manager if measurement system changed
        if (partialSettings.measurementSystem !== undefined) {
            DefaultsManager.getInstance().updateMeasurementSystem(
                partialSettings.measurementSystem
            );
        }
    }

    resetToDefaults() {
        this.settings = { ...DEFAULT_SETTINGS };
        saveSettings(this.settings);

        // Update the defaults manager with default measurement system
        DefaultsManager.getInstance().updateMeasurementSystem(
            DEFAULT_SETTINGS.measurementSystem
        );
    }
}

// Export the settings store instance
export const settingsStore = new SettingsStore();
