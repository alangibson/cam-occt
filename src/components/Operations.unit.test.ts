import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { toolStore, type Tool } from '$lib/stores/tools';
import { operationsStore } from '$lib/stores/operations';
import { CutDirection, LeadType } from '$lib/types/direction';

describe('Operations Store Integration', () => {
  beforeEach(() => {
    toolStore.reset();
    operationsStore.reset();
  });

  it('should add tools to the tool store correctly', () => {
    const testTool: Omit<Tool, 'id'> = {
      toolNumber: 1,
      toolName: 'Test Tool 1',
      feedRate: 100,
      rapidRate: 3000,
      pierceHeight: 3.8,
      pierceDelay: 0.5,
      arcVoltage: 120,
      kerfWidth: 1.5,
      thcEnable: true,
      gasPressure: 4.5,
      pauseAtEnd: 0,
      puddleJumpHeight: 50,
      puddleJumpDelay: 0,
      plungeRate: 500
    };

    toolStore.addTool(testTool);

    const toolsInStore = get(toolStore);
    expect(toolsInStore).toHaveLength(1);
    expect(toolsInStore[0].toolName).toBe('Test Tool 1');
    expect(toolsInStore[0].toolNumber).toBe(1);
    expect(toolsInStore[0]).toHaveProperty('id');
  });

  it('should create operations that reference tools', () => {
    // First add a tool
    toolStore.addTool({
      toolNumber: 1,
      toolName: 'Test Tool 1',
      feedRate: 100,
      rapidRate: 3000,
      pierceHeight: 3.8,
      pierceDelay: 0.5,
      arcVoltage: 120,
      kerfWidth: 1.5,
      thcEnable: true,
      gasPressure: 4.5,
      pauseAtEnd: 0,
      puddleJumpHeight: 50,
      puddleJumpDelay: 0,
      plungeRate: 500
    });

    const tools = get(toolStore);
    const toolId = tools[0].id;

    // Create an operation that references the tool
    operationsStore.addOperation({
      name: 'Test Operation',
      toolId: toolId,
      targetType: 'parts',
      targetIds: [],
      enabled: true,
      order: 1,
      cutDirection: CutDirection.COUNTERCLOCKWISE,
      leadInType: LeadType.NONE,
      leadInLength: 5,
      leadInFlipSide: false,
      leadInAngle: 0,
      leadInFit: false,
      leadOutType: LeadType.NONE,
      leadOutLength: 5,
      leadOutFlipSide: false,
      leadOutAngle: 0,
      leadOutFit: false
    });

    const operations = get(operationsStore);
    expect(operations).toHaveLength(1);
    expect(operations[0].toolId).toBe(toolId);
    expect(operations[0].name).toBe('Test Operation');
  });

  it('should handle multiple tools in store', () => {
    // Add multiple tools
    toolStore.addTool({
      toolNumber: 1,
      toolName: 'Tool One',
      feedRate: 100,
      rapidRate: 3000,
      pierceHeight: 3.8,
      pierceDelay: 0.5,
      arcVoltage: 120,
      kerfWidth: 1.5,
      thcEnable: true,
      gasPressure: 4.5,
      pauseAtEnd: 0,
      puddleJumpHeight: 50,
      puddleJumpDelay: 0,
      plungeRate: 500
    });

    toolStore.addTool({
      toolNumber: 2,
      toolName: 'Tool Two',
      feedRate: 200,
      rapidRate: 4000,
      pierceHeight: 4.0,
      pierceDelay: 0.6,
      arcVoltage: 130,
      kerfWidth: 2.0,
      thcEnable: false,
      gasPressure: 5.0,
      pauseAtEnd: 1,
      puddleJumpHeight: 60,
      puddleJumpDelay: 0.5,
      plungeRate: 600
    });

    const tools = get(toolStore);
    expect(tools).toHaveLength(2);
    expect(tools[0].toolName).toBe('Tool One');
    expect(tools[1].toolName).toBe('Tool Two');
    expect(tools[0].toolNumber).toBe(1);
    expect(tools[1].toolNumber).toBe(2);
  });

  it('should verify tool store subscription behavior', () => {
    let callbackTriggered = false;
    let receivedTools: Tool[] = [];

    // Subscribe to the store
    const unsubscribe = toolStore.subscribe((tools) => {
      callbackTriggered = true;
      receivedTools = tools;
    });

    // Add a tool
    toolStore.addTool({
      toolNumber: 1,
      toolName: 'Subscription Test Tool',
      feedRate: 100,
      rapidRate: 3000,
      pierceHeight: 3.8,
      pierceDelay: 0.5,
      arcVoltage: 120,
      kerfWidth: 1.5,
      thcEnable: true,
      gasPressure: 4.5,
      pauseAtEnd: 0,
      puddleJumpHeight: 50,
      puddleJumpDelay: 0,
      plungeRate: 500
    });

    expect(callbackTriggered).toBe(true);
    expect(receivedTools).toHaveLength(1);
    expect(receivedTools[0].toolName).toBe('Subscription Test Tool');

    unsubscribe();
  });
});