// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ToolBar from './ToolBar.svelte';
import { drawingStore } from '../lib/stores/drawing';
import type { Drawing, Shape } from '../lib/types';


// Mock window.prompt and window.alert
Object.defineProperty(window, 'prompt', {
  value: vi.fn(),
  writable: true
});

Object.defineProperty(window, 'alert', {
  value: vi.fn(),
  writable: true
});

describe('ToolBar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    drawingStore.setDisplayUnit('mm');
  });

  it('should render without errors', () => {
    const { container } = render(ToolBar);
    expect(container).toBeDefined();
  });

  it('should show selection count in delete button', () => {
    const mockDrawing: Drawing = {
      shapes: [
        {
          id: '1',
          type: 'line',
          geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
          layer: '0'
        },
        {
          id: '2',
          type: 'line',
          geometry: { start: { x: 0, y: 0 }, end: { x: 5, y: 5 } },
          layer: '0'
        }
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
      units: 'mm'
    };

    drawingStore.setDrawing(mockDrawing);
    drawingStore.selectShape('1');
    drawingStore.selectShape('2', true);

    const { getByText } = render(ToolBar);
    expect(getByText('Delete (2)')).toBeDefined();
  });

  it('should disable buttons when no shapes are selected', () => {
    // Clear any existing selection
    drawingStore.clearSelection();
    
    const { getByText } = render(ToolBar);
    
    const deleteButton = getByText(/Delete \(\d+\)/);
    const scaleButton = getByText('Scale');
    const rotateButton = getByText('Rotate');
    
    expect(deleteButton.closest('button')?.disabled).toBe(true);
    expect(scaleButton.closest('button')?.disabled).toBe(true);
    expect(rotateButton.closest('button')?.disabled).toBe(true);
  });

  it('should enable buttons when shapes are selected', () => {
    const mockDrawing: Drawing = {
      shapes: [
        {
          id: '1',
          type: 'line',
          geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
          layer: '0'
        }
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
      units: 'mm'
    };

    drawingStore.setDrawing(mockDrawing);
    drawingStore.selectShape('1');

    const { getByText } = render(ToolBar);
    
    const deleteButton = getByText(/Delete \(1\)/);
    const scaleButton = getByText('Scale');
    
    expect(deleteButton.closest('button')?.disabled).toBe(false);
    expect(scaleButton.closest('button')?.disabled).toBe(false);
  });


  it('should display file name when present', () => {
    const mockDrawing: Drawing = {
      shapes: [],
      bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
      units: 'mm'
    };

    drawingStore.setDrawing(mockDrawing, 'test-file.dxf');
    const { getByText } = render(ToolBar);
    
    expect(getByText('test-file.dxf')).toBeDefined();
  });

});