/**
 * State machine implementation for application workflow management
 * Provides explicit state transitions and validation
 */

export interface StateTransition<TState = any, TEvent = any> {
  from: TState;
  to: TState;
  event: TEvent;
  guard?: (context: any) => boolean;
  action?: (context: any, event: any) => void | Promise<void>;
}

export interface StateMachineOptions<TState, TEvent> {
  /**
   * Initial state
   */
  initialState: TState;
  
  /**
   * State transitions
   */
  transitions: StateTransition<TState, TEvent>[];
  
  /**
   * State entry actions (executed when entering state)
   */
  onEntry?: Partial<Record<TState, (context: any, fromState?: TState) => void | Promise<void>>>;
  
  /**
   * State exit actions (executed when leaving state)
   */
  onExit?: Partial<Record<TState, (context: any, toState?: TState) => void | Promise<void>>>;
  
  /**
   * Global error handler
   */
  onError?: (error: Error, state: TState, event: TEvent, context: any) => void;
}

export interface StateChangeEvent<TState, TEvent> {
  fromState: TState;
  toState: TState;
  event: TEvent;
  timestamp: number;
}

/**
 * Generic state machine with type safety
 */
export class StateMachine<TState = string, TEvent = string> {
  private currentState: TState;
  private context: any = {};
  private readonly transitions: Map<string, StateTransition<TState, TEvent>[]>;
  private readonly options: StateMachineOptions<TState, TEvent>;
  private readonly history: StateChangeEvent<TState, TEvent>[] = [];
  private readonly listeners = new Set<(event: StateChangeEvent<TState, TEvent>) => void>();
  
  constructor(options: StateMachineOptions<TState, TEvent>) {
    this.options = options;
    this.currentState = options.initialState;
    this.transitions = new Map();
    
    // Group transitions by from state
    for (const transition of options.transitions) {
      const key = String(transition.from);
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    }
  }
  
  /**
   * Get current state
   */
  getState(): TState {
    return this.currentState;
  }
  
  /**
   * Get current context
   */
  getContext(): any {
    return { ...this.context };
  }
  
  /**
   * Set context data
   */
  setContext(context: any): void {
    this.context = { ...this.context, ...context };
  }
  
  /**
   * Check if an event can be processed in current state
   */
  canTransition(event: TEvent): boolean {
    const fromStateTransitions = this.transitions.get(String(this.currentState));
    if (!fromStateTransitions) {
      return false;
    }
    
    const validTransition = fromStateTransitions.find(t => 
      t.event === event && (!t.guard || t.guard(this.context))
    );
    
    return !!validTransition;
  }
  
  /**
   * Process an event and transition to new state if valid
   */
  async transition(event: TEvent, eventData?: any): Promise<boolean> {
    const fromState = this.currentState;
    const fromStateTransitions = this.transitions.get(String(fromState));
    
    if (!fromStateTransitions) {
      return false;
    }
    
    // Find valid transition
    const validTransition = fromStateTransitions.find(t => 
      t.event === event && (!t.guard || t.guard(this.context))
    );
    
    if (!validTransition) {
      return false;
    }
    
    try {
      // Execute exit action for current state
      if (this.options.onExit?.[fromState]) {
        await this.options.onExit[fromState]!(this.context, validTransition.to);
      }
      
      // Execute transition action
      if (validTransition.action) {
        await validTransition.action(this.context, eventData);
      }
      
      // Change state
      this.currentState = validTransition.to;
      
      // Execute entry action for new state
      if (this.options.onEntry?.[validTransition.to]) {
        await this.options.onEntry[validTransition.to]!(this.context, fromState);
      }
      
      // Record state change
      const stateChangeEvent: StateChangeEvent<TState, TEvent> = {
        fromState,
        toState: validTransition.to,
        event,
        timestamp: Date.now()
      };
      
      this.history.push(stateChangeEvent);
      
      // Notify listeners
      for (const listener of this.listeners) {
        try {
          listener(stateChangeEvent);
        } catch (error) {
          console.error('Error in state change listener:', error);
        }
      }
      
      return true;
      
    } catch (error) {
      if (this.options.onError) {
        this.options.onError(error as Error, fromState, event, this.context);
      } else {
        console.error('Error in state transition:', error);
      }
      return false;
    }
  }
  
  /**
   * Get valid events for current state
   */
  getValidEvents(): TEvent[] {
    const fromStateTransitions = this.transitions.get(String(this.currentState));
    if (!fromStateTransitions) {
      return [];
    }
    
    return fromStateTransitions
      .filter(t => !t.guard || t.guard(this.context))
      .map(t => t.event);
  }
  
  /**
   * Get all possible states
   */
  getAllStates(): TState[] {
    const states = new Set<TState>();
    
    for (const transitions of this.transitions.values()) {
      for (const transition of transitions) {
        states.add(transition.from);
        states.add(transition.to);
      }
    }
    
    return Array.from(states);
  }
  
  /**
   * Get state history
   */
  getHistory(): StateChangeEvent<TState, TEvent>[] {
    return [...this.history];
  }
  
  /**
   * Clear state history
   */
  clearHistory(): void {
    this.history.length = 0;
  }
  
  /**
   * Listen to state changes
   */
  onStateChange(listener: (event: StateChangeEvent<TState, TEvent>) => void): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Reset to initial state
   */
  async reset(): Promise<void> {
    const oldState = this.currentState;
    
    // Execute exit action for current state if not already at initial state
    if (this.currentState !== this.options.initialState && this.options.onExit?.[this.currentState]) {
      await this.options.onExit[this.currentState]!(this.context, this.options.initialState);
    }
    
    this.currentState = this.options.initialState;
    this.context = {};
    
    // Execute entry action for initial state
    if (this.options.onEntry?.[this.options.initialState]) {
      await this.options.onEntry[this.options.initialState]!(this.context, oldState);
    }
  }
}

/**
 * CAM OCCT Application States
 */
export enum AppState {
  IDLE = 'idle',
  LOADING = 'loading',
  LOADED = 'loaded',
  MODIFYING = 'modifying',
  PROGRAMMING = 'programming',
  EXPORTING = 'exporting',
  ERROR = 'error'
}

/**
 * CAM OCCT Application Events
 */
export enum AppEvent {
  LOAD_FILE = 'load_file',
  LOAD_SUCCESS = 'load_success',
  LOAD_ERROR = 'load_error',
  START_MODIFY = 'start_modify',
  FINISH_MODIFY = 'finish_modify',
  START_PROGRAM = 'start_program',
  FINISH_PROGRAM = 'finish_program',
  START_EXPORT = 'start_export',
  FINISH_EXPORT = 'finish_export',
  ERROR_OCCURRED = 'error_occurred',
  RETRY = 'retry',
  RESET = 'reset'
}

/**
 * Application context interface
 */
export interface AppContext {
  file?: File;
  shapes?: any[];
  geometries?: any[];
  selectedShape?: number;
  cutPaths?: any[];
  gcode?: string;
  error?: Error;
  previousState?: AppState;
}

/**
 * Factory for creating CAM OCCT application state machine
 */
export class AppStateMachineFactory {
  /**
   * Create the main application state machine
   */
  static create(): StateMachine<AppState, AppEvent> {
    return new StateMachine<AppState, AppEvent>({
      initialState: AppState.IDLE,
      transitions: [
        // From IDLE
        { from: AppState.IDLE, to: AppState.LOADING, event: AppEvent.LOAD_FILE },
        
        // From LOADING
        { from: AppState.LOADING, to: AppState.LOADED, event: AppEvent.LOAD_SUCCESS },
        { from: AppState.LOADING, to: AppState.ERROR, event: AppEvent.LOAD_ERROR },
        
        // From LOADED
        { from: AppState.LOADED, to: AppState.MODIFYING, event: AppEvent.START_MODIFY },
        { from: AppState.LOADED, to: AppState.PROGRAMMING, event: AppEvent.START_PROGRAM },
        { from: AppState.LOADED, to: AppState.LOADING, event: AppEvent.LOAD_FILE },
        
        // From MODIFYING
        { from: AppState.MODIFYING, to: AppState.LOADED, event: AppEvent.FINISH_MODIFY },
        { from: AppState.MODIFYING, to: AppState.ERROR, event: AppEvent.ERROR_OCCURRED },
        
        // From PROGRAMMING
        { from: AppState.PROGRAMMING, to: AppState.LOADED, event: AppEvent.FINISH_PROGRAM },
        { from: AppState.PROGRAMMING, to: AppState.EXPORTING, event: AppEvent.START_EXPORT },
        { from: AppState.PROGRAMMING, to: AppState.ERROR, event: AppEvent.ERROR_OCCURRED },
        
        // From EXPORTING
        { from: AppState.EXPORTING, to: AppState.PROGRAMMING, event: AppEvent.FINISH_EXPORT },
        { from: AppState.EXPORTING, to: AppState.ERROR, event: AppEvent.ERROR_OCCURRED },
        
        // From ERROR
        { from: AppState.ERROR, to: AppState.IDLE, event: AppEvent.RETRY, 
          guard: (context: AppContext) => context.previousState === AppState.IDLE },
        { from: AppState.ERROR, to: AppState.LOADING, event: AppEvent.RETRY,
          guard: (context: AppContext) => context.previousState === AppState.LOADING },
        { from: AppState.ERROR, to: AppState.LOADED, event: AppEvent.RETRY,
          guard: (context: AppContext) => context.previousState === AppState.LOADED },
        { from: AppState.ERROR, to: AppState.MODIFYING, event: AppEvent.RETRY,
          guard: (context: AppContext) => context.previousState === AppState.MODIFYING },
        { from: AppState.ERROR, to: AppState.PROGRAMMING, event: AppEvent.RETRY,
          guard: (context: AppContext) => context.previousState === AppState.PROGRAMMING },
        
        // Global reset
        { from: AppState.LOADED, to: AppState.IDLE, event: AppEvent.RESET },
        { from: AppState.MODIFYING, to: AppState.IDLE, event: AppEvent.RESET },
        { from: AppState.PROGRAMMING, to: AppState.IDLE, event: AppEvent.RESET },
        { from: AppState.EXPORTING, to: AppState.IDLE, event: AppEvent.RESET },
        { from: AppState.ERROR, to: AppState.IDLE, event: AppEvent.RESET }
      ],
      
      onEntry: {
        [AppState.LOADING]: (context: AppContext) => {
          console.log('Entering LOADING state');
        },
        [AppState.LOADED]: (context: AppContext) => {
          console.log('Entering LOADED state');
        },
        [AppState.MODIFYING]: (context: AppContext) => {
          console.log('Entering MODIFYING state');
        },
        [AppState.PROGRAMMING]: (context: AppContext) => {
          console.log('Entering PROGRAMMING state');
        },
        [AppState.EXPORTING]: (context: AppContext) => {
          console.log('Entering EXPORTING state');
        },
        [AppState.ERROR]: (context: AppContext) => {
          console.log('Entering ERROR state:', context.error?.message);
        }
      },
      
      onExit: {
        [AppState.ERROR]: (context: AppContext, toState?: AppState) => {
          // Clear error when leaving error state
          if (toState !== AppState.ERROR) {
            delete context.error;
          }
        }
      },
      
      onError: (error: Error, state: AppState, event: AppEvent, context: AppContext) => {
        console.error(`State machine error in state ${state} with event ${event}:`, error);
        context.error = error;
        context.previousState = state;
      }
    });
  }
}

/**
 * State machine builder for creating custom state machines
 */
export class StateMachineBuilder<TState = string, TEvent = string> {
  private initialState?: TState;
  private transitions: StateTransition<TState, TEvent>[] = [];
  private onEntry: Partial<Record<TState, (context: any, fromState?: TState) => void | Promise<void>>> = {};
  private onExit: Partial<Record<TState, (context: any, toState?: TState) => void | Promise<void>>> = {};
  private onError?: (error: Error, state: TState, event: TEvent, context: any) => void;
  
  /**
   * Set initial state
   */
  withInitialState(state: TState): this {
    this.initialState = state;
    return this;
  }
  
  /**
   * Add state transition
   */
  addTransition(
    from: TState, 
    to: TState, 
    event: TEvent, 
    options?: {
      guard?: (context: any) => boolean;
      action?: (context: any, event: any) => void | Promise<void>;
    }
  ): this {
    this.transitions.push({
      from,
      to,
      event,
      guard: options?.guard,
      action: options?.action
    });
    return this;
  }
  
  /**
   * Add state entry action
   */
  addEntryAction(state: TState, action: (context: any, fromState?: TState) => void | Promise<void>): this {
    this.onEntry[state] = action;
    return this;
  }
  
  /**
   * Add state exit action
   */
  addExitAction(state: TState, action: (context: any, toState?: TState) => void | Promise<void>): this {
    this.onExit[state] = action;
    return this;
  }
  
  /**
   * Set error handler
   */
  withErrorHandler(handler: (error: Error, state: TState, event: TEvent, context: any) => void): this {
    this.onError = handler;
    return this;
  }
  
  /**
   * Build the state machine
   */
  build(): StateMachine<TState, TEvent> {
    if (!this.initialState) {
      throw new Error('Initial state must be set');
    }
    
    return new StateMachine<TState, TEvent>({
      initialState: this.initialState,
      transitions: this.transitions,
      onEntry: this.onEntry,
      onExit: this.onExit,
      onError: this.onError
    });
  }
}