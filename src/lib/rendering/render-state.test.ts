import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RenderStateManager, PanStateManager } from './render-state';

describe('RenderStateManager', () => {
  let renderState: RenderStateManager;

  beforeEach(() => {
    renderState = new RenderStateManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('markDirty', () => {
    it('should mark a single aspect as dirty', () => {
      renderState.markDirty('geometry');
      expect(renderState.needsRenderFor('geometry')).toBe(true);
      expect(renderState.needsRenderFor('transforms')).toBe(false);
    });

    it('should handle all render flag types', () => {
      const flags = ['geometry', 'transforms', 'selection', 'paths', 'overlays'] as const;
      
      flags.forEach(flag => {
        renderState.markDirty(flag);
        expect(renderState.needsRenderFor(flag)).toBe(true);
      });
    });
  });

  describe('markMultipleDirty', () => {
    it('should mark multiple aspects as dirty', () => {
      renderState.markMultipleDirty(['geometry', 'selection']);
      
      expect(renderState.needsRenderFor('geometry')).toBe(true);
      expect(renderState.needsRenderFor('selection')).toBe(true);
      expect(renderState.needsRenderFor('transforms')).toBe(false);
    });

    it('should handle empty array', () => {
      renderState.markMultipleDirty([]);
      expect(renderState.needsRender()).toBe(false);
    });
  });

  describe('needsRender', () => {
    it('should return false when no flags are dirty', () => {
      expect(renderState.needsRender()).toBe(false);
    });

    it('should return true when any flag is dirty', () => {
      renderState.markDirty('geometry');
      expect(renderState.needsRender()).toBe(true);
    });

    it('should return true when multiple flags are dirty', () => {
      renderState.markMultipleDirty(['geometry', 'transforms']);
      expect(renderState.needsRender()).toBe(true);
    });
  });

  describe('needsRenderFor', () => {
    it('should return correct status for specific flags', () => {
      renderState.markDirty('selection');
      
      expect(renderState.needsRenderFor('selection')).toBe(true);
      expect(renderState.needsRenderFor('geometry')).toBe(false);
    });
  });

  describe('clearFlags', () => {
    it('should clear all dirty flags', () => {
      renderState.markMultipleDirty(['geometry', 'transforms', 'selection']);
      
      renderState.clearFlags();
      
      expect(renderState.needsRender()).toBe(false);
      expect(renderState.needsRenderFor('geometry')).toBe(false);
      expect(renderState.needsRenderFor('transforms')).toBe(false);
      expect(renderState.needsRenderFor('selection')).toBe(false);
    });
  });

  describe('getFlags', () => {
    it('should return copy of current flags', () => {
      renderState.markMultipleDirty(['geometry', 'selection']);
      
      const flags = renderState.getFlags();
      
      expect(flags.geometry).toBe(true);
      expect(flags.selection).toBe(true);
      expect(flags.transforms).toBe(false);
      expect(flags.paths).toBe(false);
      expect(flags.overlays).toBe(false);
    });

    it('should return immutable copy', () => {
      renderState.markDirty('geometry');
      const flags = renderState.getFlags();
      
      flags.geometry = false;
      
      expect(renderState.needsRenderFor('geometry')).toBe(true);
    });
  });

  describe('requestRender', () => {
    it('should call render function immediately when enough time has passed', () => {
      const mockRender = vi.fn();
      renderState.markDirty('geometry');
      
      renderState.requestRender(mockRender);
      
      // Need to advance RAF to trigger the render
      vi.runAllTimers();
      
      expect(mockRender).toHaveBeenCalled();
    });

    it('should throttle rapid render requests', () => {
      const mockRender = vi.fn();
      renderState.markDirty('geometry');
      
      vi.setSystemTime(0);
      renderState.requestRender(mockRender);
      vi.runAllTimers();
      
      // Mark dirty again for second call  
      renderState.markDirty('geometry');
      vi.setSystemTime(8); // Less than minFrameInterval (16ms)
      renderState.requestRender(mockRender);
      
      // Second call should be throttled and delayed
      expect(mockRender).toHaveBeenCalledTimes(1);
      
      // Advance time to trigger the throttled render
      vi.advanceTimersByTime(8); // Complete the throttle delay
      vi.runAllTimers();
      
      // Now both renders should have completed
      expect(mockRender).toHaveBeenCalledTimes(2);
    });

    it('should not request render when no flags are dirty', () => {
      const mockRender = vi.fn();
      
      renderState.requestRender(mockRender);
      
      expect(mockRender).not.toHaveBeenCalled();
    });

    it('should not create duplicate render requests', () => {
      const mockRender = vi.fn();
      renderState.markDirty('geometry');
      
      vi.setSystemTime(0);
      renderState.requestRender(mockRender);
      
      vi.setSystemTime(8);
      renderState.requestRender(mockRender);
      renderState.requestRender(mockRender);
      
      vi.runAllTimers();
      
      expect(mockRender).toHaveBeenCalledTimes(1);
    });
  });
});

describe('PanStateManager', () => {
  let panState: PanStateManager;

  beforeEach(() => {
    panState = new PanStateManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setPanOffset', () => {
    it('should set current offset immediately', () => {
      const offset = { x: 100, y: 200 };
      
      panState.setPanOffset(offset);
      
      expect(panState.getCurrentOffset()).toEqual(offset);
    });

    it('should stop any ongoing animation', () => {
      const mockUpdate = vi.fn();
      panState.animatePanTo({ x: 50, y: 50 }, mockUpdate);
      
      expect(panState.isActive()).toBe(true);
      
      panState.setPanOffset({ x: 100, y: 200 });
      
      expect(panState.isActive()).toBe(false);
    });
  });

  describe('getCurrentOffset', () => {
    it('should return initial offset as {0,0}', () => {
      expect(panState.getCurrentOffset()).toEqual({ x: 0, y: 0 });
    });

    it('should return immutable copy of offset', () => {
      panState.setPanOffset({ x: 10, y: 20 });
      const offset = panState.getCurrentOffset();
      
      offset.x = 999;
      
      expect(panState.getCurrentOffset().x).toBe(10);
    });
  });

  describe('addPanVelocity', () => {
    it('should add velocity to current velocity', () => {
      const mockUpdate = vi.fn();
      
      panState.addPanVelocity({ x: 5, y: 10 });
      panState.addPanVelocity({ x: 3, y: -2 });
      
      panState.animatePanTo({ x: 0, y: 0 }, mockUpdate);
      
      vi.runOnlyPendingTimers();
      
      expect(mockUpdate).toHaveBeenCalled();
      const offset = mockUpdate.mock.calls[0][0];
      expect(offset.x).toBeGreaterThan(0);
      expect(offset.y).toBeGreaterThan(0);
    });
  });

  describe('animatePanTo', () => {
    it('should start animation when called', () => {
      const mockUpdate = vi.fn();
      const target = { x: 100, y: 100 };
      
      panState.animatePanTo(target, mockUpdate);
      
      expect(panState.isActive()).toBe(true);
    });

    it('should gradually move towards target', () => {
      const mockUpdate = vi.fn();
      const target = { x: 100, y: 100 };
      
      panState.animatePanTo(target, mockUpdate);
      
      vi.runOnlyPendingTimers();
      
      expect(mockUpdate).toHaveBeenCalled();
      const firstCall = mockUpdate.mock.calls[0][0];
      expect(firstCall.x).toBeGreaterThan(0);
      expect(firstCall.x).toBeLessThan(100);
    });

    it('should not start duplicate animations', () => {
      const mockUpdate = vi.fn();
      
      panState.animatePanTo({ x: 50, y: 50 }, mockUpdate);
      const wasActive = panState.isActive();
      
      panState.animatePanTo({ x: 100, y: 100 }, mockUpdate);
      
      expect(wasActive).toBe(true);
      expect(panState.isActive()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop ongoing animation', () => {
      const mockUpdate = vi.fn();
      
      panState.animatePanTo({ x: 100, y: 100 }, mockUpdate);
      expect(panState.isActive()).toBe(true);
      
      panState.stop();
      
      expect(panState.isActive()).toBe(false);
    });

    it('should reset velocity', () => {
      const mockUpdate = vi.fn();
      
      panState.addPanVelocity({ x: 10, y: 10 });
      panState.animatePanTo({ x: 0, y: 0 }, mockUpdate);
      
      panState.stop();
      
      panState.animatePanTo({ x: 0, y: 0 }, mockUpdate);
      vi.runOnlyPendingTimers();
      
      expect(panState.getCurrentOffset()).toEqual({ x: 0, y: 0 });
    });
  });

  describe('isActive', () => {
    it('should return false initially', () => {
      expect(panState.isActive()).toBe(false);
    });

    it('should return true during animation', () => {
      const mockUpdate = vi.fn();
      
      panState.animatePanTo({ x: 100, y: 100 }, mockUpdate);
      
      expect(panState.isActive()).toBe(true);
    });

    it('should return false after stopping', () => {
      const mockUpdate = vi.fn();
      
      panState.animatePanTo({ x: 100, y: 100 }, mockUpdate);
      panState.stop();
      
      expect(panState.isActive()).toBe(false);
    });
  });
});