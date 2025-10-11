/**
 * Tool Units Utilities
 *
 * Helper functions to get correct tool values based on display unit.
 * Tools store both metric and imperial values, and we need to select
 * the correct one based on the current display unit.
 */

import type { Tool } from '$lib/stores/tools/store';
import { Unit, convertUnits } from './units';

/**
 * Get the feed rate for a tool in the specified display unit
 */
export function getToolFeedRate(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        // Use imperial value if available, otherwise convert from metric
        return tool.feedRateImperial !== undefined
            ? tool.feedRateImperial
            : convertUnits(tool.feedRate, Unit.MM, Unit.INCH);
    } else {
        // Use metric value if available, otherwise use the main value
        return tool.feedRateMetric !== undefined
            ? tool.feedRateMetric
            : tool.feedRate;
    }
}

/**
 * Get the pierce height for a tool in the specified display unit
 */
export function getToolPierceHeight(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        return tool.pierceHeightImperial !== undefined
            ? tool.pierceHeightImperial
            : convertUnits(tool.pierceHeight, Unit.MM, Unit.INCH);
    } else {
        return tool.pierceHeightMetric !== undefined
            ? tool.pierceHeightMetric
            : tool.pierceHeight;
    }
}

/**
 * Get the cut height for a tool in the specified display unit
 */
export function getToolCutHeight(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        return tool.cutHeightImperial !== undefined
            ? tool.cutHeightImperial
            : convertUnits(tool.cutHeight, Unit.MM, Unit.INCH);
    } else {
        return tool.cutHeightMetric !== undefined
            ? tool.cutHeightMetric
            : tool.cutHeight;
    }
}

/**
 * Get the kerf width for a tool in the specified display unit
 */
export function getToolKerfWidth(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        return tool.kerfWidthImperial !== undefined
            ? tool.kerfWidthImperial
            : convertUnits(tool.kerfWidth, Unit.MM, Unit.INCH);
    } else {
        return tool.kerfWidthMetric !== undefined
            ? tool.kerfWidthMetric
            : tool.kerfWidth;
    }
}

/**
 * Get the puddle jump height for a tool in the specified display unit
 */
export function getToolPuddleJumpHeight(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        return tool.puddleJumpHeightImperial !== undefined
            ? tool.puddleJumpHeightImperial
            : convertUnits(tool.puddleJumpHeight, Unit.MM, Unit.INCH);
    } else {
        return tool.puddleJumpHeightMetric !== undefined
            ? tool.puddleJumpHeightMetric
            : tool.puddleJumpHeight;
    }
}

/**
 * Get the plunge rate for a tool in the specified display unit
 */
export function getToolPlungeRate(tool: Tool, displayUnit: Unit): number {
    if (displayUnit === Unit.INCH) {
        return tool.plungeRateImperial !== undefined
            ? tool.plungeRateImperial
            : convertUnits(tool.plungeRate, Unit.MM, Unit.INCH);
    } else {
        return tool.plungeRateMetric !== undefined
            ? tool.plungeRateMetric
            : tool.plungeRate;
    }
}
