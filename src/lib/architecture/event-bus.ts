/**
 * Event-driven architecture with domain isolation
 * Provides decoupled communication between components
 */

export interface BaseEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly data: any;
}

export interface EventHandler<T extends BaseEvent = BaseEvent> {
  (event: T): void | Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
}

export interface EventBusOptions {
  /**
   * Maximum number of concurrent event handlers
   */
  maxConcurrency?: number;
  
  /**
   * Whether to log events for debugging
   */
  enableLogging?: boolean;
  
  /**
   * Global error handler for failed event handlers
   */
  onError?: (error: Error, event: BaseEvent, handler: EventHandler) => void;
}

/**
 * Type-safe event bus with domain isolation and error handling
 */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly options: Required<EventBusOptions>;
  private readonly eventQueue: Array<{ event: BaseEvent; handlers: EventHandler[] }> = [];
  private isProcessing = false;
  
  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxConcurrency: options.maxConcurrency ?? 10,
      enableLogging: options.enableLogging ?? false,
      onError: options.onError ?? this.defaultErrorHandler
    };
  }
  
  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): EventSubscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler as EventHandler);
    
    if (this.options.enableLogging) {
      console.log(`[EventBus] Subscribed to event: ${eventType}`);
    }
    
    // Return subscription with unsubscribe capability
    return {
      unsubscribe: () => {
        const typeHandlers = this.handlers.get(eventType);
        if (typeHandlers) {
          typeHandlers.delete(handler as EventHandler);
          if (typeHandlers.size === 0) {
            this.handlers.delete(eventType);
          }
        }
        
        if (this.options.enableLogging) {
          console.log(`[EventBus] Unsubscribed from event: ${eventType}`);
        }
      }
    };
  }
  
  /**
   * Subscribe to multiple event types with same handler
   */
  subscribeMultiple<T extends BaseEvent>(eventTypes: string[], handler: EventHandler<T>): EventSubscription {
    const subscriptions = eventTypes.map(type => this.subscribe(type, handler));
    
    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      }
    };
  }
  
  /**
   * Subscribe to events matching a pattern (using regex)
   */
  subscribePattern<T extends BaseEvent>(pattern: RegExp, handler: EventHandler<T>): EventSubscription {
    const matchingTypes = new Set<string>();
    
    // Subscribe to existing types that match
    for (const eventType of this.handlers.keys()) {
      if (pattern.test(eventType)) {
        matchingTypes.add(eventType);
      }
    }
    
    const subscriptions = Array.from(matchingTypes).map(type => this.subscribe(type, handler));
    
    // Create a wrapper to handle future events that match the pattern
    const patternHandler = (event: BaseEvent) => {
      if (pattern.test(event.type)) {
        return (handler as EventHandler)(event);
      }
    };
    
    return {
      unsubscribe: () => {
        subscriptions.forEach(sub => sub.unsubscribe());
      }
    };
  }
  
  /**
   * Emit an event to all subscribers
   */
  async emit<T extends BaseEvent>(event: Omit<T, 'timestamp'> & { type: string }): Promise<void> {
    const fullEvent: BaseEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    const typeHandlers = this.handlers.get(event.type);
    if (!typeHandlers || typeHandlers.size === 0) {
      if (this.options.enableLogging) {
        console.log(`[EventBus] No handlers for event: ${event.type}`);
      }
      return;
    }
    
    const handlers = Array.from(typeHandlers);
    
    if (this.options.enableLogging) {
      console.log(`[EventBus] Emitting event: ${event.type} to ${handlers.length} handlers`);
    }
    
    // Add to queue for processing
    this.eventQueue.push({ event: fullEvent, handlers });
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processEventQueue();
    }
  }
  
  /**
   * Emit event synchronously (use with caution)
   */
  emitSync<T extends BaseEvent>(event: Omit<T, 'timestamp'> & { type: string }): void {
    const fullEvent: BaseEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    const typeHandlers = this.handlers.get(event.type);
    if (!typeHandlers || typeHandlers.size === 0) {
      return;
    }
    
    const handlers = Array.from(typeHandlers);
    
    for (const handler of handlers) {
      try {
        const result = handler(fullEvent);
        
        // If handler returns a promise, we can't wait for it in sync mode
        if (result && typeof result.then === 'function') {
          console.warn(`[EventBus] Async handler called in sync emit for event: ${event.type}`);
        }
      } catch (error) {
        this.options.onError(error as Error, fullEvent, handler);
      }
    }
  }
  
  /**
   * Get number of subscribers for an event type
   */
  getSubscriberCount(eventType: string): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }
  
  /**
   * Get all registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
  
  /**
   * Clear all subscribers for an event type
   */
  clearSubscribers(eventType: string): void {
    this.handlers.delete(eventType);
    
    if (this.options.enableLogging) {
      console.log(`[EventBus] Cleared all subscribers for event: ${eventType}`);
    }
  }
  
  /**
   * Clear all event subscribers
   */
  clearAllSubscribers(): void {
    this.handlers.clear();
    this.eventQueue.length = 0;
    
    if (this.options.enableLogging) {
      console.log(`[EventBus] Cleared all event subscribers`);
    }
  }
  
  /**
   * Wait for all pending events to be processed
   */
  async flush(): Promise<void> {
    while (this.eventQueue.length > 0 || this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }
  
  /**
   * Process queued events with concurrency control
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      while (this.eventQueue.length > 0) {
        const batch = this.eventQueue.splice(0, this.options.maxConcurrency);
        
        await Promise.allSettled(
          batch.map(({ event, handlers }) => this.processEventHandlers(event, handlers))
        );
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Process handlers for a single event
   */
  private async processEventHandlers(event: BaseEvent, handlers: EventHandler[]): Promise<void> {
    const promises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.options.onError(error as Error, event, handler);
      }
    });
    
    await Promise.all(promises);
  }
  
  /**
   * Default error handler
   */
  private defaultErrorHandler = (error: Error, event: BaseEvent, handler: EventHandler): void => {
    console.error(`[EventBus] Handler failed for event ${event.type}:`, error);
  };
}

/**
 * Domain-specific event types for type safety
 */
export namespace Events {
  export interface GeometryEvent extends BaseEvent {
    type: 'geometry.loaded' | 'geometry.modified' | 'geometry.deleted' | 'geometry.selected';
    data: {
      shapes?: any[];
      geometries?: any[];
      shapeIndex?: number;
      operation?: string;
    };
  }
  
  export interface SelectionEvent extends BaseEvent {
    type: 'selection.changed' | 'selection.cleared' | 'selection.hover';
    data: {
      shapeIndex?: number;
      object?: any;
      intersection?: any;
      shapeInfo?: any;
    };
  }
  
  export interface ViewerEvent extends BaseEvent {
    type: 'viewer.zoom.changed' | 'viewer.camera.moved' | 'viewer.resize';
    data: {
      zoomLevel?: number;
      cameraPosition?: any;
      viewport?: { width: number; height: number };
    };
  }
  
  export interface ApplicationEvent extends BaseEvent {
    type: 'app.stage.changed' | 'app.file.loaded' | 'app.error';
    data: {
      stage?: string;
      file?: File;
      error?: Error;
      previousStage?: string;
    };
  }
  
  export interface CoordinateEvent extends BaseEvent {
    type: 'coordinate.system.changed' | 'coordinate.units.changed';
    data: {
      fromSystem?: string;
      toSystem?: string;
      unitsPerMeter?: number;
    };
  }
}

/**
 * Typed event emitter for specific domains
 */
export class TypedEventBus<T extends BaseEvent = BaseEvent> {
  constructor(private eventBus: EventBus) {}
  
  subscribe(eventType: T['type'], handler: EventHandler<T>): EventSubscription {
    return this.eventBus.subscribe(eventType as string, handler as EventHandler);
  }
  
  async emit(event: Omit<T, 'timestamp'>): Promise<void> {
    return this.eventBus.emit(event as any);
  }
  
  emitSync(event: Omit<T, 'timestamp'>): void {
    return this.eventBus.emitSync(event as any);
  }
}

/**
 * Factory for creating domain-specific event buses
 */
export class EventBusFactory {
  private static globalBus?: EventBus;
  
  /**
   * Get or create global event bus
   */
  static getGlobalBus(options?: EventBusOptions): EventBus {
    if (!EventBusFactory.globalBus) {
      EventBusFactory.globalBus = new EventBus(options);
    }
    return EventBusFactory.globalBus;
  }
  
  /**
   * Create typed event bus for geometry events
   */
  static createGeometryBus(eventBus?: EventBus): TypedEventBus<Events.GeometryEvent> {
    return new TypedEventBus(eventBus || EventBusFactory.getGlobalBus());
  }
  
  /**
   * Create typed event bus for selection events
   */
  static createSelectionBus(eventBus?: EventBus): TypedEventBus<Events.SelectionEvent> {
    return new TypedEventBus(eventBus || EventBusFactory.getGlobalBus());
  }
  
  /**
   * Create typed event bus for viewer events
   */
  static createViewerBus(eventBus?: EventBus): TypedEventBus<Events.ViewerEvent> {
    return new TypedEventBus(eventBus || EventBusFactory.getGlobalBus());
  }
  
  /**
   * Create typed event bus for application events
   */
  static createApplicationBus(eventBus?: EventBus): TypedEventBus<Events.ApplicationEvent> {
    return new TypedEventBus(eventBus || EventBusFactory.getGlobalBus());
  }
  
  /**
   * Reset global bus (useful for testing)
   */
  static resetGlobalBus(): void {
    EventBusFactory.globalBus = undefined;
  }
}