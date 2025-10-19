import type { Tool } from '$lib/cam/tool/interfaces';

// Default tool values for new tools
export const DEFAULT_TOOL_VALUES: Omit<Tool, 'id' | 'toolNumber' | 'toolName'> =
    {
        feedRate: 100,
        pierceHeight: 3.8,
        cutHeight: 1.5,
        pierceDelay: 0.5,
        arcVoltage: 120,
        kerfWidth: 1.5,
        thcEnable: true,
        gasPressure: 4.5,
        pauseAtEnd: 0,
        puddleJumpHeight: 50,
        puddleJumpDelay: 0,
        plungeRate: 500,
    };
