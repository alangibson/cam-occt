/**
 * Tool utility functions
 */

import type { Tool } from './interfaces';
import { settingsStore } from '$lib/stores/settings/store';
import { get } from 'svelte/store';
import { MeasurementSystem } from '$lib/config/settings/enums';

/**
 * Get the correct tool value based on the measurement system
 */
export function getToolValue(
    tool: Tool,
    field:
        | 'feedRate'
        | 'pierceHeight'
        | 'cutHeight'
        | 'kerfWidth'
        | 'puddleJumpHeight'
        | 'plungeRate'
): number {
    const settings = get(settingsStore).settings;
    const isMetric = settings.measurementSystem === MeasurementSystem.Metric;

    // Check for unit-specific fields
    const metricField = `${field}Metric` as keyof Tool;
    const imperialField = `${field}Imperial` as keyof Tool;

    if (isMetric && tool[metricField] !== undefined) {
        return tool[metricField] as number;
    } else if (!isMetric && tool[imperialField] !== undefined) {
        return tool[imperialField] as number;
    }

    // Fall back to the base field
    return tool[field];
}
