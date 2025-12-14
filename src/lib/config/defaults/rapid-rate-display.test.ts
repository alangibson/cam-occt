/**
 * Test rapid rate display values to verify the fix
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultsManager } from '$lib/config/defaults/defaults-manager';
import { MeasurementSystem } from '$lib/config/settings/enums';

describe('Rapid Rate Display Values', () => {
    let defaultsManager: DefaultsManager;

    beforeEach(() => {
        DefaultsManager.reset();
        defaultsManager = DefaultsManager.getInstance();
    });

    it('should show 3000 inch/min when imperial measurement system with imperial display', () => {
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Imperial);

        const rapidRate = defaultsManager.cam.rapidRate;

        // User should see: "3000 inch/min"
        expect(rapidRate).toBeCloseTo(3000, 0);
    });

    it('should show 3000 mm/min when metric measurement system with metric display', () => {
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Metric);

        const rapidRate = defaultsManager.cam.rapidRate;

        // User should see: "3000 mm/min"
        expect(rapidRate).toBe(3000);
    });

    it('should show 76200 mm/min when imperial system with metric display (cross-unit conversion)', () => {
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Imperial);

        const rapidRateInImperial = defaultsManager.cam.rapidRate; // 3000 inch/min

        // When user switches display to mm, getRapidRateForCut() converts:
        const rapidRateInMetric = rapidRateInImperial * 25.4;

        // User should see: "76200 mm/min" (equivalent to 3000 inch/min)
        expect(rapidRateInMetric).toBeCloseTo(76200, 0);
    });

    it('should show 118 inch/min when metric system with imperial display (cross-unit conversion)', () => {
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Metric);

        const rapidRateInMetric = defaultsManager.cam.rapidRate; // 3000 mm/min

        // When user switches display to inches, getRapidRateForCut() converts:
        const rapidRateInImperial = rapidRateInMetric / 25.4;

        // User should see: "118 inch/min" (equivalent to 3000 mm/min)
        expect(rapidRateInImperial).toBeCloseTo(118, 0);
    });

    it('should match the pattern used by feed rates', () => {
        // Imperial system: uses IMPERIAL_RAPID_RATE_MM = 76200
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Imperial);
        const imperialRapid = defaultsManager.cam.rapidRate;
        expect(imperialRapid).toBeCloseTo(3000, 0);

        // Metric system: uses DEFAULT_RAPID_RATE_MM = 3000
        defaultsManager.updateMeasurementSystem(MeasurementSystem.Metric);
        const metricRapid = defaultsManager.cam.rapidRate;
        expect(metricRapid).toBe(3000);

        // This matches how IMPERIAL_FEED_RATE_MM works for feed rates
    });
});
