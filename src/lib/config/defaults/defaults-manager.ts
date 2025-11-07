/**
 * Defaults Manager
 *
 * Central manager for all default configuration values in MetalHead CAM.
 * Coordinates all default classes and provides a single point of access
 * for getting defaults based on the current measurement system.
 */

import { MeasurementSystem } from '$lib/config/settings/enums';
import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings/store';
import { CamDefaults } from './cam-defaults';
import { LeadDefaults } from './lead-defaults';
import { ChainDefaults } from './chain-defaults';
import { GeometryDefaults } from './geometry-defaults';
import { AlgorithmDefaults } from './algorithm-defaults';

export class DefaultsManager {
    private static instance: DefaultsManager | null = null;

    public readonly cam: CamDefaults;
    public readonly lead: LeadDefaults;
    public readonly chain: ChainDefaults;
    public readonly geometry: GeometryDefaults;
    public readonly algorithm: AlgorithmDefaults;

    private measurementSystem: MeasurementSystem;

    private constructor() {
        // Initialize with Metric first to have valid defaults
        this.measurementSystem = MeasurementSystem.Metric;

        // Initialize all default classes
        this.cam = new CamDefaults(this.measurementSystem);
        this.lead = new LeadDefaults(this.measurementSystem);
        this.chain = new ChainDefaults(this.measurementSystem);
        this.geometry = new GeometryDefaults(this.measurementSystem);
        this.algorithm = new AlgorithmDefaults(this.measurementSystem);

        // Immediately sync with settingsStore to get actual measurement system
        // This prevents race conditions during HMR where defaults might return
        // wrong unit values before external sync completes
        this.initializeFromSettings();
    }

    /**
     * Get the singleton instance of DefaultsManager
     */
    static getInstance(): DefaultsManager {
        if (!DefaultsManager.instance) {
            DefaultsManager.instance = new DefaultsManager();
        }
        return DefaultsManager.instance;
    }

    /**
     * Update the measurement system for all default classes
     * This should be called when the user changes their measurement system preference
     */
    updateMeasurementSystem(system: MeasurementSystem): void {
        this.measurementSystem = system;

        // Update all default classes
        this.cam.setMeasurementSystem(system);
        this.lead.setMeasurementSystem(system);
        this.chain.setMeasurementSystem(system);
        this.geometry.setMeasurementSystem(system);
        this.algorithm.setMeasurementSystem(system);
    }

    /**
     * Get the current measurement system
     */
    getMeasurementSystem(): MeasurementSystem {
        return this.measurementSystem;
    }

    /**
     * Initialize the measurement system from settings store
     * This should be called once the settings store is ready
     */
    initializeFromSettings(): void {
        try {
            const settings = get(settingsStore);
            this.updateMeasurementSystem(settings.settings.measurementSystem);
        } catch {
            // Settings store not ready yet, keep default
            console.warn(
                'Settings store not ready during DefaultsManager initialization'
            );
        }
    }

    /**
     * Reset the instance (useful for testing)
     */
    static reset(): void {
        DefaultsManager.instance = null;
    }
}

// Export a convenient getter function for the singleton
export function getDefaults(): DefaultsManager {
    return DefaultsManager.getInstance();
}
