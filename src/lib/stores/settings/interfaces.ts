/**
 * Application Settings Store Interfaces
 *
 * Type definitions for global application settings including measurement systems.
 */

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
 * Application settings interface
 */
export interface ApplicationSettings {
    /** Global measurement system for the application */
    measurementSystem: MeasurementSystem;

    /** Default behavior for import unit handling */
    importUnitSetting: ImportUnitSetting;
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

    /** Update all settings at once */
    updateSettings: (settings: Partial<ApplicationSettings>) => void;

    /** Reset settings to defaults */
    resetToDefaults: () => void;
}
