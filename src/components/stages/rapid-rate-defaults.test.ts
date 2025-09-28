import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultsManager } from '$lib/config/defaults-manager';
import { MeasurementSystem } from '$lib/stores/settings/interfaces';

describe('Rapid Rate from DefaultsManager', () => {
    beforeEach(() => {
        // Reset DefaultsManager
        DefaultsManager.reset();
    });

    it('should get rapid rate in metric units', () => {
        const defaults = DefaultsManager.getInstance();
        defaults.updateMeasurementSystem(MeasurementSystem.Metric);

        const rapidRate = defaults.cam.rapidRate;

        // Should be 3000 mm/min in metric
        expect(rapidRate).toBe(3000);
    });

    it('should get rapid rate in imperial units', () => {
        const defaults = DefaultsManager.getInstance();
        defaults.updateMeasurementSystem(MeasurementSystem.Imperial);

        const rapidRate = defaults.cam.rapidRate;

        // Should be converted to inches/min (3000 mm/min ≈ 118.11 in/min)
        expect(rapidRate).toBeCloseTo(118.11, 2);
    });

    it('should automatically update rapid rate when measurement system changes', () => {
        const defaults = DefaultsManager.getInstance();

        // Start with metric
        defaults.updateMeasurementSystem(MeasurementSystem.Metric);
        expect(defaults.cam.rapidRate).toBe(3000);

        // Switch to imperial
        defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
        expect(defaults.cam.rapidRate).toBeCloseTo(118.11, 2);

        // Switch back to metric
        defaults.updateMeasurementSystem(MeasurementSystem.Metric);
        expect(defaults.cam.rapidRate).toBe(3000);
    });
});
