// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ToolBar from './ToolBar.svelte';
import { drawingStore } from '../lib/stores/drawing';
import type { Drawing, Shape } from '../lib/types';

// Mock the algorithms
vi.mock('../lib/algorithms/decompose-polylines', () => ({
  decomposePolylines: vi.fn((shapes: Shape[]) => shapes)
}));

vi.mock('../lib/algorithms/translate-to-positive', () => ({
  translateToPositiveQuadrant: vi.fn((shapes: Shape[]) => shapes)
}));

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
    const clearButton = getByText('Clear Selection');
    
    expect(deleteButton.closest('button')?.disabled).toBe(true);
    expect(scaleButton.closest('button')?.disabled).toBe(true);
    expect(rotateButton.closest('button')?.disabled).toBe(true);
    expect(clearButton.closest('button')?.disabled).toBe(true);
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

  it('should call decompose polylines when button is clicked', async () => {
    const mockDrawing: Drawing = {
      shapes: [
        {
          id: '1',
          type: 'polyline',
          geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }] },
          layer: '0'
        }
      ],
      bounds: { min: { x: 0, y: 0 }, max: { x: 20, y: 10 } },
      units: 'mm'
    };

    drawingStore.setDrawing(mockDrawing);

    const { decomposePolylines } = await import('../lib/algorithms/decompose-polylines');
    const { getByText } = render(ToolBar);
    
    const decomposeButton = getByText('Decompose Polylines');
    await fireEvent.click(decomposeButton);
    
    expect(decomposePolylines).toHaveBeenCalledWith(mockDrawing.shapes);
  });

  it('should call translate to positive when button is clicked', async () => {
    const mockDrawing: Drawing = {
      shapes: [
        {
          id: '1',
          type: 'line',
          geometry: { start: { x: -10, y: -10 }, end: { x: 0, y: 0 } },
          layer: '0'
        }
      ],
      bounds: { min: { x: -10, y: -10 }, max: { x: 0, y: 0 } },
      units: 'mm'
    };

    drawingStore.setDrawing(mockDrawing);

    const { translateToPositiveQuadrant } = await import('../lib/algorithms/translate-to-positive');
    const { getByText } = render(ToolBar);
    
    const translateButton = getByText('Translate to Positive');
    await fireEvent.click(translateButton);
    
    expect(translateToPositiveQuadrant).toHaveBeenCalledWith(mockDrawing.shapes);
  });

  it('should show alert when trying to decompose with no shapes', async () => {
    // Set empty drawing
    drawingStore.setDrawing({ shapes: [], bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' });
    
    const { getByText } = render(ToolBar);
    
    const decomposeButton = getByText('Decompose Polylines');
    await fireEvent.click(decomposeButton);
    
    expect(window.alert).toHaveBeenCalledWith('No drawing loaded or no shapes to decompose.');
  });

  it('should show alert when trying to translate with no shapes', async () => {
    // Set empty drawing
    drawingStore.setDrawing({ shapes: [], bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } }, units: 'mm' });
    
    const { getByText } = render(ToolBar);
    
    const translateButton = getByText('Translate to Positive');
    await fireEvent.click(translateButton);
    
    expect(window.alert).toHaveBeenCalledWith('No drawing loaded or no shapes to translate.');
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

  it('should enable drawing operations when drawing is loaded', () => {
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
    const { getByText } = render(ToolBar);
    
    const decomposeButton = getByText('Decompose Polylines');
    const translateButton = getByText('Translate to Positive');
    
    // Buttons should be enabled when drawing exists
    expect(decomposeButton.closest('button')?.disabled).toBe(false);
    expect(translateButton.closest('button')?.disabled).toBe(false);
  });
});