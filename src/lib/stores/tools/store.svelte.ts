import type { Tool } from '$lib/cam/tool/interfaces';
import { getDefaults } from '$lib/config/defaults/defaults-manager';

/**
 * Create a new tool with proper dual-unit defaults
 */
export function createDefaultTool(toolNumber: number): Omit<Tool, 'id'> {
    // Get defaults from DefaultsManager based on current measurement system
    const defaults = getDefaults();
    const camDefaults = defaults.cam;

    // Default imperial values
    const imperialDefaults = {
        feedRate: 40, // inch/min
        pierceHeight: 0.04, // inch
        cutHeight: 0.06, // inch
        kerfWidth: 0.06, // inch
        puddleJumpHeight: 0.02, // inch
        plungeRate: 20, // inch/min
    };

    return {
        toolNumber: toolNumber,
        toolName: `Tool ${toolNumber}`,
        feedRate: camDefaults.feedRate, // Legacy field for current system
        feedRateMetric: camDefaults.feedRate, // Metric default
        feedRateImperial: imperialDefaults.feedRate, // Imperial default
        pierceHeight: camDefaults.pierceHeight,
        pierceHeightMetric: camDefaults.pierceHeight,
        pierceHeightImperial: imperialDefaults.pierceHeight,
        cutHeight: camDefaults.cutHeight,
        cutHeightMetric: camDefaults.cutHeight,
        cutHeightImperial: imperialDefaults.cutHeight,
        pierceDelay: camDefaults.pierceDelay,
        arcVoltage: 120,
        kerfWidth: camDefaults.kerfWidth,
        kerfWidthMetric: camDefaults.kerfWidth,
        kerfWidthImperial: imperialDefaults.kerfWidth,
        thcEnable: true,
        gasPressure: 4.5,
        pauseAtEnd: 0,
        puddleJumpHeight: camDefaults.puddleJumpHeight,
        puddleJumpHeightMetric: camDefaults.puddleJumpHeight,
        puddleJumpHeightImperial: imperialDefaults.puddleJumpHeight,
        puddleJumpDelay: 0,
        plungeRate: camDefaults.plungeRate,
        plungeRateMetric: camDefaults.plungeRate,
        plungeRateImperial: imperialDefaults.plungeRate,
    };
}

class ToolStore {
    tools = $state<Tool[]>([]);

    addTool(tool: Omit<Tool, 'id'>) {
        this.tools = [
            ...this.tools,
            {
                ...tool,
                id: crypto.randomUUID(),
            },
        ];
    }

    updateTool(id: string, updates: Partial<Tool>) {
        this.tools = this.tools.map((tool) =>
            tool.id === id ? { ...tool, ...updates } : tool
        );
    }

    deleteTool(id: string) {
        this.tools = this.tools.filter((tool) => tool.id !== id);
    }

    reorderTools(newOrder: Tool[]) {
        this.tools = newOrder;
    }

    reset() {
        this.tools = [];
    }
}

export const toolStore = new ToolStore();
