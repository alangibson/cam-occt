/**
 * Example: Unit Conversion in Action
 *
 * This file demonstrates how the DefaultsManager automatically converts
 * values based on the current measurement system.
 */

import { MeasurementSystem } from '$lib/stores/settings/interfaces';
import { DefaultsManager } from './defaults-manager';

// Display precision constants
const PRECISION_4_DECIMAL = 4;
const PRECISION_1_DECIMAL = 1;
const PRECISION_6_DECIMAL = 6;

/**
 * Example function showing unit conversion in action
 */
export function demonstrateUnitConversion() {
    console.log('=== MetalHead CAM Unit Conversion Demo ===\n');

    // Get the defaults manager instance
    const defaults = DefaultsManager.getInstance();

    // Test with Metric system (mm)
    console.log('📏 Setting measurement system to METRIC (mm):');
    defaults.updateMeasurementSystem(MeasurementSystem.Metric);

    console.log(`  Pierce Height: ${defaults.cam.pierceHeight} mm`);
    console.log(`  Cut Height: ${defaults.cam.cutHeight} mm`);
    console.log(`  Feed Rate: ${defaults.cam.feedRate} mm/min`);
    console.log(`  Lead-In Length: ${defaults.lead.leadInLength} mm`);
    console.log(`  Lead-Out Length: ${defaults.lead.leadOutLength} mm`);
    console.log(
        `  Chain Detection Tolerance: ${defaults.chain.detectionTolerance} mm`
    );
    console.log(`  Max Extension: ${defaults.algorithm.maxExtension} mm\n`);

    // Test with Imperial system (inches)
    console.log('📐 Setting measurement system to IMPERIAL (inches):');
    defaults.updateMeasurementSystem(MeasurementSystem.Imperial);

    console.log(
        `  Pierce Height: ${defaults.cam.pierceHeight.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Cut Height: ${defaults.cam.cutHeight.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Feed Rate: ${defaults.cam.feedRate.toFixed(PRECISION_1_DECIMAL)} inch/min`
    );
    console.log(
        `  Lead-In Length: ${defaults.lead.leadInLength.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Lead-Out Length: ${defaults.lead.leadOutLength.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Chain Detection Tolerance: ${defaults.chain.detectionTolerance.toFixed(PRECISION_6_DECIMAL)} inch`
    );
    console.log(
        `  Max Extension: ${defaults.algorithm.maxExtension.toFixed(PRECISION_4_DECIMAL)} inch\n`
    );

    console.log(
        '✨ All values automatically converted based on measurement system!'
    );
    console.log(
        '🔄 User values stored in their preferred system (no conversion needed)'
    );
    console.log('📦 Defaults use single source of truth (mm constants)');
}

/**
 * Example: Creating a tool with unit-aware defaults
 */
export function createToolExample() {
    console.log('\n=== Creating Tool Example ===\n');

    const defaults = DefaultsManager.getInstance();

    // Simulate creating a tool in metric system
    defaults.updateMeasurementSystem(MeasurementSystem.Metric);
    const metricTool = {
        toolNumber: 1,
        toolName: 'Metric Tool',
        feedRate: defaults.cam.feedRate,
        pierceHeight: defaults.cam.pierceHeight,
        cutHeight: defaults.cam.cutHeight,
        pierceDelay: defaults.cam.pierceDelay,
    };

    console.log('🔧 Tool created in METRIC system:');
    console.log(`  Feed Rate: ${metricTool.feedRate} mm/min`);
    console.log(`  Pierce Height: ${metricTool.pierceHeight} mm`);
    console.log(`  Cut Height: ${metricTool.cutHeight} mm\n`);

    // Simulate creating a tool in imperial system
    defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
    const imperialTool = {
        toolNumber: 2,
        toolName: 'Imperial Tool',
        feedRate: defaults.cam.feedRate,
        pierceHeight: defaults.cam.pierceHeight,
        cutHeight: defaults.cam.cutHeight,
        pierceDelay: defaults.cam.pierceDelay,
    };

    console.log('🔧 Tool created in IMPERIAL system:');
    console.log(
        `  Feed Rate: ${imperialTool.feedRate.toFixed(PRECISION_1_DECIMAL)} inch/min`
    );
    console.log(
        `  Pierce Height: ${imperialTool.pierceHeight.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Cut Height: ${imperialTool.cutHeight.toFixed(PRECISION_4_DECIMAL)} inch\n`
    );

    console.log('💡 Same defaults system, different measurement systems!');
}

/**
 * Example: Creating operations with unit-aware lead defaults
 */
export function createOperationExample() {
    console.log('\n=== Creating Operation Example ===\n');

    const defaults = DefaultsManager.getInstance();

    // Create operation in metric
    defaults.updateMeasurementSystem(MeasurementSystem.Metric);
    const metricOperation = {
        name: 'Metric Cut',
        leadInConfig: {
            type: 'ARC',
            length: defaults.lead.leadInLength,
        },
        leadOutConfig: {
            type: 'ARC',
            length: defaults.lead.leadOutLength,
        },
    };

    console.log('⚙️ Operation created in METRIC system:');
    console.log(`  Lead-In Length: ${metricOperation.leadInConfig.length} mm`);
    console.log(
        `  Lead-Out Length: ${metricOperation.leadOutConfig.length} mm\n`
    );

    // Create operation in imperial
    defaults.updateMeasurementSystem(MeasurementSystem.Imperial);
    const imperialOperation = {
        name: 'Imperial Cut',
        leadInConfig: {
            type: 'ARC',
            length: defaults.lead.leadInLength,
        },
        leadOutConfig: {
            type: 'ARC',
            length: defaults.lead.leadOutLength,
        },
    };

    console.log('⚙️ Operation created in IMPERIAL system:');
    console.log(
        `  Lead-In Length: ${imperialOperation.leadInConfig.length.toFixed(PRECISION_4_DECIMAL)} inch`
    );
    console.log(
        `  Lead-Out Length: ${imperialOperation.leadOutConfig.length.toFixed(PRECISION_4_DECIMAL)} inch\n`
    );

    console.log(
        '🎯 Perfect for international users with different unit preferences!'
    );
}

// Uncomment to run the examples:
// demonstrateUnitConversion();
// createToolExample();
// createOperationExample();
