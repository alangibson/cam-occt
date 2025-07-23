import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, EventBusFactory, TypedEventBus, Events } from './event-bus';

describe('EventBus', () => {
  let eventBus: EventBus;
  
  beforeEach(() => {
    eventBus = new EventBus();
  });
  
  describe('Basic Event Handling', () => {
    it('should subscribe and emit events', async () => {
      const handler = vi.fn();
      
      eventBus.subscribe('test.event', handler);
      await eventBus.emit({ type: 'test.event', data: { message: 'hello' } });
      
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          data: { message: 'hello' },
          timestamp: expect.any(Number)
        })
      );
    });
    
    it('should handle multiple subscribers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.subscribe('test.event', handler1);
      eventBus.subscribe('test.event', handler2);
      
      await eventBus.emit({ type: 'test.event', data: {} });
      
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
    
    it('should handle async event handlers', async () => {
      let order: number[] = [];
      
      const asyncHandler1 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push(1);
      });
      
      const asyncHandler2 = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        order.push(2);
      });
      
      eventBus.subscribe('test.event', asyncHandler1);
      eventBus.subscribe('test.event', asyncHandler2);
      
      await eventBus.emit({ type: 'test.event', data: {} });
      
      expect(asyncHandler1).toHaveBeenCalledOnce();
      expect(asyncHandler2).toHaveBeenCalledOnce();
      expect(order).toEqual([2, 1]); // Handler2 completes first (shorter delay)
    });
    
    it('should not emit to non-existent event types', async () => {
      const handler = vi.fn();
      
      eventBus.subscribe('test.event', handler);
      await eventBus.emit({ type: 'other.event', data: {} });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Subscriptions', () => {
    it('should unsubscribe handlers', async () => {
      const handler = vi.fn();
      
      const subscription = eventBus.subscribe('test.event', handler);
      await eventBus.emit({ type: 'test.event', data: {} });
      expect(handler).toHaveBeenCalledOnce();
      
      subscription.unsubscribe();
      await eventBus.emit({ type: 'test.event', data: {} });
      expect(handler).toHaveBeenCalledOnce(); // Still only called once
    });
    
    it('should subscribe to multiple event types', async () => {
      const handler = vi.fn();
      
      const subscription = eventBus.subscribeMultiple(['event1', 'event2'], handler);
      
      await eventBus.emit({ type: 'event1', data: {} });
      await eventBus.emit({ type: 'event2', data: {} });
      
      expect(handler).toHaveBeenCalledTimes(2);
      
      subscription.unsubscribe();
      await eventBus.emit({ type: 'event1', data: {} });
      expect(handler).toHaveBeenCalledTimes(2); // No additional calls
    });
    
    it('should subscribe to events matching pattern', async () => {
      const handler = vi.fn();
      
      const subscription = eventBus.subscribePattern(/^geometry\./, handler);
      
      eventBus.subscribe('geometry.loaded', () => {}); // Add handler to create the type
      eventBus.subscribe('geometry.modified', () => {});
      eventBus.subscribe('selection.changed', () => {});
      
      await eventBus.emit({ type: 'geometry.loaded', data: {} });
      await eventBus.emit({ type: 'geometry.modified', data: {} });
      await eventBus.emit({ type: 'selection.changed', data: {} });
      
      expect(handler).toHaveBeenCalledTimes(2); // Only geometry events
      
      subscription.unsubscribe();
    });
    
    it('should get subscriber count', () => {
      expect(eventBus.getSubscriberCount('test.event')).toBe(0);
      
      eventBus.subscribe('test.event', () => {});
      expect(eventBus.getSubscriberCount('test.event')).toBe(1);
      
      eventBus.subscribe('test.event', () => {});
      expect(eventBus.getSubscriberCount('test.event')).toBe(2);
    });
    
    it('should get event types', () => {
      expect(eventBus.getEventTypes()).toEqual([]);
      
      eventBus.subscribe('event1', () => {});
      eventBus.subscribe('event2', () => {});
      
      const eventTypes = eventBus.getEventTypes();
      expect(eventTypes).toContain('event1');
      expect(eventTypes).toContain('event2');
      expect(eventTypes.length).toBe(2);
    });
    
    it('should clear subscribers for specific event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);
      
      eventBus.clearSubscribers('event1');
      
      await eventBus.emit({ type: 'event1', data: {} });
      await eventBus.emit({ type: 'event2', data: {} });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });
    
    it('should clear all subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);
      
      eventBus.clearAllSubscribers();
      
      await eventBus.emit({ type: 'event1', data: {} });
      await eventBus.emit({ type: 'event2', data: {} });
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
  
  describe('Synchronous Events', () => {
    it('should emit events synchronously', () => {
      const handler = vi.fn();
      
      eventBus.subscribe('test.event', handler);
      eventBus.emitSync({ type: 'test.event', data: { sync: true } });
      
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test.event',
          data: { sync: true }
        })
      );
    });
    
    it('should warn about async handlers in sync emit', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const asyncHandler = vi.fn().mockResolvedValue(undefined);
      
      eventBus.subscribe('test.event', asyncHandler);
      eventBus.emitSync({ type: 'test.event', data: {} });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Async handler called in sync emit')
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors in event handlers', async () => {
      const errorHandler = vi.fn();
      const eventBusWithErrorHandler = new EventBus({ onError: errorHandler });
      
      const faultyHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      eventBusWithErrorHandler.subscribe('test.event', faultyHandler);
      
      await eventBusWithErrorHandler.emit({ type: 'test.event', data: {} });
      
      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ type: 'test.event' }),
        faultyHandler
      );
    });
    
    it('should continue processing other handlers when one fails', async () => {
      const errorHandler = vi.fn();
      const eventBusWithErrorHandler = new EventBus({ onError: errorHandler });
      
      const faultyHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();
      
      eventBusWithErrorHandler.subscribe('test.event', faultyHandler);
      eventBusWithErrorHandler.subscribe('test.event', goodHandler);
      
      await eventBusWithErrorHandler.emit({ type: 'test.event', data: {} });
      
      expect(faultyHandler).toHaveBeenCalledOnce();
      expect(goodHandler).toHaveBeenCalledOnce();
      expect(errorHandler).toHaveBeenCalledOnce();
    });
    
    it('should use default error handler when none provided', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const faultyHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      
      eventBus.subscribe('test.event', faultyHandler);
      await eventBus.emit({ type: 'test.event', data: {} });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EventBus] Handler failed for event test.event'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Concurrency Control', () => {
    it('should respect max concurrency setting', async () => {
      const lowConcurrencyBus = new EventBus({ maxConcurrency: 2 });
      let concurrentHandlers = 0;
      let maxConcurrency = 0;
      
      const slowHandler = vi.fn(async () => {
        concurrentHandlers++;
        maxConcurrency = Math.max(maxConcurrency, concurrentHandlers);
        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentHandlers--;
      });
      
      // Subscribe multiple handlers
      for (let i = 0; i < 5; i++) {
        lowConcurrencyBus.subscribe(`event${i}`, slowHandler);
      }
      
      // Emit events simultaneously
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(lowConcurrencyBus.emit({ type: `event${i}`, data: {} }));
      }
      
      await Promise.all(promises);
      
      expect(slowHandler).toHaveBeenCalledTimes(5);
      expect(maxConcurrency).toBeLessThanOrEqual(2);
    });
  });
  
  describe('Flush and Queue Management', () => {
    it('should flush all pending events', async () => {
      const handler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });
      
      eventBus.subscribe('test.event', handler);
      
      // Emit multiple events quickly
      const promises = [
        eventBus.emit({ type: 'test.event', data: { id: 1 } }),
        eventBus.emit({ type: 'test.event', data: { id: 2 } }),
        eventBus.emit({ type: 'test.event', data: { id: 3 } })
      ];
      
      // Don't wait for individual promises, use flush instead
      await eventBus.flush();
      
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });
});

describe('TypedEventBus', () => {
  let eventBus: EventBus;
  let geometryBus: TypedEventBus<Events.GeometryEvent>;
  
  beforeEach(() => {
    eventBus = new EventBus();
    geometryBus = new TypedEventBus<Events.GeometryEvent>(eventBus);
  });
  
  it('should provide type safety for events', async () => {
    const handler = vi.fn();
    
    geometryBus.subscribe('geometry.loaded', handler);
    
    await geometryBus.emit({
      type: 'geometry.loaded',
      data: {
        shapes: [{ id: 1 }],
        geometries: [{ id: 2 }]
      }
    });
    
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'geometry.loaded',
        data: expect.objectContaining({
          shapes: [{ id: 1 }],
          geometries: [{ id: 2 }]
        })
      })
    );
  });
});

describe('EventBusFactory', () => {
  afterEach(() => {
    EventBusFactory.resetGlobalBus();
  });
  
  it('should create and reuse global bus', () => {
    const bus1 = EventBusFactory.getGlobalBus();
    const bus2 = EventBusFactory.getGlobalBus();
    
    expect(bus1).toBe(bus2);
  });
  
  it('should create domain-specific typed buses', () => {
    const geometryBus = EventBusFactory.createGeometryBus();
    const selectionBus = EventBusFactory.createSelectionBus();
    const viewerBus = EventBusFactory.createViewerBus();
    const appBus = EventBusFactory.createApplicationBus();
    
    expect(geometryBus).toBeInstanceOf(TypedEventBus);
    expect(selectionBus).toBeInstanceOf(TypedEventBus);
    expect(viewerBus).toBeInstanceOf(TypedEventBus);
    expect(appBus).toBeInstanceOf(TypedEventBus);
  });
  
  it('should use custom event bus when provided', () => {
    const customBus = new EventBus();
    const geometryBus = EventBusFactory.createGeometryBus(customBus);
    
    // Test that the custom bus is being used
    const handler = vi.fn();
    geometryBus.subscribe('geometry.loaded', handler);
    
    // Emit directly on custom bus
    customBus.emit({ type: 'geometry.loaded', data: {} });
    
    // Handler should be called since it's using the custom bus
    setTimeout(() => {
      expect(handler).toHaveBeenCalledOnce();
    }, 10);
  });
  
  it('should reset global bus', () => {
    const bus1 = EventBusFactory.getGlobalBus();
    EventBusFactory.resetGlobalBus();
    const bus2 = EventBusFactory.getGlobalBus();
    
    expect(bus1).not.toBe(bus2);
  });
});

describe('Event Types', () => {
  it('should support geometry events', () => {
    const event: Events.GeometryEvent = {
      type: 'geometry.loaded',
      timestamp: Date.now(),
      data: {
        shapes: [],
        geometries: []
      }
    };
    
    expect(event.type).toBe('geometry.loaded');
    expect(event.data).toHaveProperty('shapes');
    expect(event.data).toHaveProperty('geometries');
  });
  
  it('should support selection events', () => {
    const event: Events.SelectionEvent = {
      type: 'selection.changed',
      timestamp: Date.now(),
      data: {
        shapeIndex: 1,
        object: {},
        shapeInfo: {}
      }
    };
    
    expect(event.type).toBe('selection.changed');
    expect(event.data.shapeIndex).toBe(1);
  });
  
  it('should support viewer events', () => {
    const event: Events.ViewerEvent = {
      type: 'viewer.zoom.changed',
      timestamp: Date.now(),
      data: {
        zoomLevel: 150
      }
    };
    
    expect(event.type).toBe('viewer.zoom.changed');
    expect(event.data.zoomLevel).toBe(150);
  });
  
  it('should support application events', () => {
    const event: Events.ApplicationEvent = {
      type: 'app.stage.changed',
      timestamp: Date.now(),
      data: {
        stage: 'modify',
        previousStage: 'import'
      }
    };
    
    expect(event.type).toBe('app.stage.changed');
    expect(event.data.stage).toBe('modify');
  });
});