import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanStateManager } from './render-state';

// RenderStateManager tests removed - functionality no longer exists
// describe('RenderStateManager', () => {
//     The markDirty, markMultipleDirty, needsRender, needsRenderFor, clearFlags,
//     getFlags, and requestRender functionality has been removed from the codebase
// });

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
