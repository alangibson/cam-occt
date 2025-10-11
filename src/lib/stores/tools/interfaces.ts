export interface Tool {
    id: string;
    toolNumber: number;
    toolName: string;
    feedRate: number; // metric: mm/min, imperial: in/min (stored based on measurement system)
    feedRateMetric?: number; // mm/min
    feedRateImperial?: number; // in/min
    pierceHeight: number; // units
    pierceHeightMetric?: number; // mm
    pierceHeightImperial?: number; // in
    cutHeight: number; // units
    cutHeightMetric?: number; // mm
    cutHeightImperial?: number; // in
    pierceDelay: number; // seconds
    arcVoltage: number; // volts
    kerfWidth: number; // units
    kerfWidthMetric?: number; // mm
    kerfWidthImperial?: number; // in
    thcEnable: boolean;
    gasPressure: number; // bar
    pauseAtEnd: number; // seconds
    puddleJumpHeight: number; // units
    puddleJumpHeightMetric?: number; // mm
    puddleJumpHeightImperial?: number; // in
    puddleJumpDelay: number; // seconds
    plungeRate: number; // units/min
    plungeRateMetric?: number; // mm/min
    plungeRateImperial?: number; // in/min
}

export interface ToolStore {
    subscribe: (run: (value: Tool[]) => void) => () => void;
    addTool: (tool: Omit<Tool, 'id'>) => void;
    updateTool: (id: string, updates: Partial<Tool>) => void;
    deleteTool: (id: string) => void;
    reorderTools: (newOrder: Tool[]) => void;
    reset: () => void;
}
