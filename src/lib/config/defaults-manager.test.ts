import { describe, it, expect, beforeEach } from 'vitest';
import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { DefaultsManager } from './defaults-manager';
import { THOUSANDTHS_PRECISION_FACTOR } from '$lib/utils/units';
import { settingsStore } from '$lib/stores/settings/store';

describe('DefaultsManager', () => {
    let defaults: DefaultsManager;

    beforeEach(() => {
        // Reset the singleton for each test
        DefaultsManager.reset();
        defaults = DefaultsManager.getInstance();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = DefaultsManager.getInstance();
            const instance2 = DefaultsManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Measurement System Conversion', () => {
        it('should provide metric defaults by default', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(defaults.cam.pierceHeight).toBe(1); // mm
            expect(defaults.cam.cutHeight).toBe(1.5); // mm
            expect(defaults.cam.feedRate).toBe(1000); // mm/min
            expect(defaults.lead.leadInLength).toBe(2); // mm
            expect(defaults.lead.leadOutLength).toBe(2); // mm
        });

        it('should convert to imperial units correctly', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Imperial);

            // Check conversions (mm / 25.4 = inches, rounded to thousandths)
            expect(defaults.cam.pierceHeight).toBe(
                Math.round((1 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
            expect(defaults.cam.cutHeight).toBe(
                Math.round((1.5 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
            expect(defaults.cam.feedRate).toBe(
                Math.round((1000 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
            expect(defaults.lead.leadInLength).toBe(
                Math.round((2 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
            expect(defaults.lead.leadOutLength).toBe(
                Math.round((2 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
        });

        it('should maintain precision for small tolerances', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Imperial);

            // Very small tolerances should still convert accurately (rounded to thousandths)
            const tolerance = defaults.chain.detectionTolerance;
            expect(tolerance).toBe(
                Math.round((0.05 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                    THOUSANDTHS_PRECISION_FACTOR
            );
        });
    });

    describe('All Default Classes', () => {
        it('should provide CAM defaults', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(defaults.cam.pierceHeight).toBeGreaterThan(0);
            expect(defaults.cam.cutHeight).toBeGreaterThan(0);
            expect(defaults.cam.feedRate).toBeGreaterThan(0);
            expect(defaults.cam.pierceDelay).toBeGreaterThan(0);
        });

        it('should provide lead defaults', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(defaults.lead.leadInLength).toBeGreaterThan(0);
            expect(defaults.lead.leadOutLength).toBeGreaterThan(0);
            expect(defaults.lead.minimumShellDistance).toBeGreaterThan(0);
            expect(defaults.lead.proximityThreshold).toBeGreaterThan(0);
        });

        it('should provide chain defaults', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(defaults.chain.detectionTolerance).toBeGreaterThan(0);
            expect(defaults.chain.traversalTolerance).toBeGreaterThan(0);
            expect(defaults.chain.maxTraversalAttempts).toBeGreaterThan(0);
        });

        it('should provide geometry defaults', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(defaults.geometry.extensionLength).toBeGreaterThan(0);
        });

        it('should provide algorithm defaults', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            expect(
                defaults.algorithm.duplicateFilteringTolerance
            ).toBeGreaterThan(0);
            expect(defaults.algorithm.maxExtension).toBeGreaterThan(0);
            expect(defaults.algorithm.areaRatioThreshold).toBeGreaterThan(0);
            expect(defaults.algorithm.areaRatioThreshold).toBeLessThan(1);
        });
    });

    describe('Unit System Consistency', () => {
        it('should update all classes when measurement system changes', () => {
            // Start with metric
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);
            const metricPierceHeight = defaults.cam.pierceHeight;
            const metricLeadLength = defaults.lead.leadInLength;
            const metricTolerance = defaults.chain.detectionTolerance;

            // Switch to imperial
            defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
            const imperialPierceHeight = defaults.cam.pierceHeight;
            const imperialLeadLength = defaults.lead.leadInLength;
            const imperialTolerance = defaults.chain.detectionTolerance;

            // Values should be different but proportional (rounded to thousandths)
            expect(imperialPierceHeight).toBe(
                Math.round(
                    (metricPierceHeight / 25.4) * THOUSANDTHS_PRECISION_FACTOR
                ) / THOUSANDTHS_PRECISION_FACTOR
            );
            expect(imperialLeadLength).toBe(
                Math.round(
                    (metricLeadLength / 25.4) * THOUSANDTHS_PRECISION_FACTOR
                ) / THOUSANDTHS_PRECISION_FACTOR
            );
            expect(imperialTolerance).toBe(
                Math.round(
                    (metricTolerance / 25.4) * THOUSANDTHS_PRECISION_FACTOR
                ) / THOUSANDTHS_PRECISION_FACTOR
            );
        });

        it('should maintain current measurement system', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
            expect(defaults.getMeasurementSystem()).toBe(
                MeasurementSystem.Imperial
            );

            defaults.updateMeasurementSystem(MeasurementSystem.Metric);
            expect(defaults.getMeasurementSystem()).toBe(
                MeasurementSystem.Metric
            );
        });
    });

    describe('Performance', () => {
        it('should handle repeated system switches efficiently', () => {
            const start = Date.now();

            // Switch back and forth many times
            for (let i = 0; i < 100; i++) {
                defaults.updateMeasurementSystem(
                    i % 2 === 0
                        ? MeasurementSystem.Metric
                        : MeasurementSystem.Imperial
                );
                // Access some values to ensure they're calculated
                void defaults.cam.pierceHeight;
                void defaults.lead.leadInLength;
                void defaults.chain.detectionTolerance;
            }

            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(100); // Should be very fast
        });
    });

    describe('Realistic Values', () => {
        it('should provide reasonable metric values', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Metric);

            // Pierce height should be between 0.5-10mm typically
            expect(defaults.cam.pierceHeight).toBeGreaterThan(0.5);
            expect(defaults.cam.pierceHeight).toBeLessThan(10);

            // Cut height should be between 0.5-5mm typically
            expect(defaults.cam.cutHeight).toBeGreaterThan(0.5);
            expect(defaults.cam.cutHeight).toBeLessThan(5);

            // Feed rate should be reasonable for plasma cutting
            expect(defaults.cam.feedRate).toBeGreaterThan(100);
            expect(defaults.cam.feedRate).toBeLessThan(5000);
        });

        it('should provide reasonable imperial values', () => {
            defaults.updateMeasurementSystem(MeasurementSystem.Imperial);

            // Pierce height should be between 0.02-0.4 inches typically
            expect(defaults.cam.pierceHeight).toBeGreaterThan(0.02);
            expect(defaults.cam.pierceHeight).toBeLessThan(0.4);

            // Cut height should be between 0.02-0.2 inches typically
            expect(defaults.cam.cutHeight).toBeGreaterThan(0.02);
            expect(defaults.cam.cutHeight).toBeLessThan(0.2);

            // Feed rate should be reasonable for plasma cutting in inches
            expect(defaults.cam.feedRate).toBeGreaterThan(4);
            expect(defaults.cam.feedRate).toBeLessThan(200);
        });
    });

    describe('HMR Reload Scenario', () => {
        it('should immediately sync with settingsStore on construction to prevent race conditions', () => {
            // This test verifies the fix for lead arc length reset during Vite HMR
            // When HMR reloads modules, DefaultsManager singleton gets reset
            // It should immediately sync with settingsStore to avoid returning
            // metric defaults when the user has imperial units selected

            // 1. User has imperial units set in settings
            settingsStore.setMeasurementSystem(MeasurementSystem.Imperial);

            // 2. Simulate HMR reload - singleton gets reset
            DefaultsManager.reset();

            // 3. Get new instance - constructor should immediately sync with settingsStore
            const newInstance = DefaultsManager.getInstance();

            // 4. Verify it has imperial values immediately, not metric defaults
            expect(newInstance.getMeasurementSystem()).toBe(
                MeasurementSystem.Imperial
            );

            // Lead lengths should be in imperial units (2mm converted to inches)
            const expectedImperialLeadLength =
                Math.round((2 / 25.4) * THOUSANDTHS_PRECISION_FACTOR) /
                THOUSANDTHS_PRECISION_FACTOR;

            expect(newInstance.lead.leadInLength).toBe(
                expectedImperialLeadLength
            );
            expect(newInstance.lead.leadOutLength).toBe(
                expectedImperialLeadLength
            );

            // Clean up - reset back to metric for other tests
            settingsStore.setMeasurementSystem(MeasurementSystem.Metric);
        });
    });
});
