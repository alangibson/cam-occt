import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultsManager } from '$lib/config/defaults/defaults-manager';
import { MeasurementSystem } from '$lib/config/settings/enums';

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

        // Should be 3000 in/min (76200 mm/min converted to imperial)
        expect(rapidRate).toBe(3000);
    });

    it('should automatically update rapid rate when measurement system changes', () => {
        const defaults = DefaultsManager.getInstance();

        // Start with metric
        defaults.updateMeasurementSystem(MeasurementSystem.Metric);
        expect(defaults.cam.rapidRate).toBe(3000);

        // Switch to imperial - should be 3000 in/min
        defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
        expect(defaults.cam.rapidRate).toBe(3000);

        // Switch back to metric
        defaults.updateMeasurementSystem(MeasurementSystem.Metric);
        expect(defaults.cam.rapidRate).toBe(3000);
    });
});
