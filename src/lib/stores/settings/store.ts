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
} from './interfaces';
import {
    MeasurementSystem as MS,
    ImportUnitSetting as IUS,
} from './interfaces';
import { DefaultsManager } from '$lib/config/defaults-manager';

// Default application settings
const DEFAULT_SETTINGS: ApplicationSettings = {
    measurementSystem: MS.Metric,
    importUnitSetting: IUS.Automatic,
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
                const newSettings = {
                    ...state.settings,
                    measurementSystem: system,
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

// Initialize DefaultsManager with the current settings after store creation
// This ensures DefaultsManager gets the correct measurement system from the store
try {
    DefaultsManager.getInstance().initializeFromSettings();
} catch {
    // Store might not be fully ready yet, DefaultsManager will use its default values
}
