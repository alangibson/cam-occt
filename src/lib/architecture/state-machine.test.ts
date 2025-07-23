import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  StateMachine, 
  AppStateMachineFactory, 
  AppState, 
  AppEvent, 
  AppContext,
  StateMachineBuilder 
} from './state-machine';

// Simple test states and events
enum TestState {
  IDLE = 'idle',
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error'
}

enum TestEvent {
  START = 'start',
  SUCCESS = 'success',
  FAIL = 'fail',
  RESET = 'reset'
}

describe('StateMachine', () => {
  let stateMachine: StateMachine<TestState, TestEvent>;
  
  beforeEach(() => {
    stateMachine = new StateMachine({
      initialState: TestState.IDLE,
      transitions: [
        { from: TestState.IDLE, to: TestState.LOADING, event: TestEvent.START },
        { from: TestState.LOADING, to: TestState.READY, event: TestEvent.SUCCESS },
        { from: TestState.LOADING, to: TestState.ERROR, event: TestEvent.FAIL },
        { from: TestState.ERROR, to: TestState.IDLE, event: TestEvent.RESET },
        { from: TestState.READY, to: TestState.IDLE, event: TestEvent.RESET }
      ]
    });
  });
  
  describe('Basic State Management', () => {
    it('should start in initial state', () => {
      expect(stateMachine.getState()).toBe(TestState.IDLE);
    });
    
    it('should transition to valid states', async () => {
      expect(stateMachine.getState()).toBe(TestState.IDLE);
      
      const success = await stateMachine.transition(TestEvent.START);
      expect(success).toBe(true);
      expect(stateMachine.getState()).toBe(TestState.LOADING);
    });
    
    it('should reject invalid transitions', async () => {
      expect(stateMachine.getState()).toBe(TestState.IDLE);
      
      const success = await stateMachine.transition(TestEvent.SUCCESS); // Invalid from IDLE
      expect(success).toBe(false);
      expect(stateMachine.getState()).toBe(TestState.IDLE); // State unchanged
    });
    
    it('should check if transitions are valid', () => {
      expect(stateMachine.canTransition(TestEvent.START)).toBe(true);
      expect(stateMachine.canTransition(TestEvent.SUCCESS)).toBe(false);
      expect(stateMachine.canTransition(TestEvent.FAIL)).toBe(false);
      expect(stateMachine.canTransition(TestEvent.RESET)).toBe(false);
    });
    
    it('should get valid events for current state', () => {
      const validEvents = stateMachine.getValidEvents();
      expect(validEvents).toEqual([TestEvent.START]);
    });
    
    it('should get all possible states', () => {
      const allStates = stateMachine.getAllStates();
      expect(allStates).toContain(TestState.IDLE);
      expect(allStates).toContain(TestState.LOADING);
      expect(allStates).toContain(TestState.READY);
      expect(allStates).toContain(TestState.ERROR);
    });
  });
  
  describe('Context Management', () => {
    it('should manage context state', () => {
      stateMachine.setContext({ userId: 123, name: 'Test' });
      
      const context = stateMachine.getContext();
      expect(context.userId).toBe(123);
      expect(context.name).toBe('Test');
    });
    
    it('should merge context updates', () => {
      stateMachine.setContext({ userId: 123 });
      stateMachine.setContext({ name: 'Test' });
      
      const context = stateMachine.getContext();
      expect(context.userId).toBe(123);
      expect(context.name).toBe('Test');
    });
  });
  
  describe('Guards', () => {
    it('should use guards to conditionally allow transitions', async () => {
      const guardedStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { 
            from: TestState.IDLE, 
            to: TestState.LOADING, 
            event: TestEvent.START,
            guard: (context) => context.isReady === true
          }
        ]
      });
      
      // Should fail without guard condition
      let success = await guardedStateMachine.transition(TestEvent.START);
      expect(success).toBe(false);
      expect(guardedStateMachine.getState()).toBe(TestState.IDLE);
      
      // Should succeed with guard condition
      guardedStateMachine.setContext({ isReady: true });
      success = await guardedStateMachine.transition(TestEvent.START);
      expect(success).toBe(true);
      expect(guardedStateMachine.getState()).toBe(TestState.LOADING);
    });
    
    it('should check guards in canTransition', () => {
      const guardedStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { 
            from: TestState.IDLE, 
            to: TestState.LOADING, 
            event: TestEvent.START,
            guard: (context) => context.isReady === true
          }
        ]
      });
      
      expect(guardedStateMachine.canTransition(TestEvent.START)).toBe(false);
      
      guardedStateMachine.setContext({ isReady: true });
      expect(guardedStateMachine.canTransition(TestEvent.START)).toBe(true);
    });
  });
  
  describe('Actions', () => {
    it('should execute transition actions', async () => {
      const action = vi.fn();
      
      const actionStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { 
            from: TestState.IDLE, 
            to: TestState.LOADING, 
            event: TestEvent.START,
            action
          }
        ]
      });
      
      await actionStateMachine.transition(TestEvent.START, { data: 'test' });
      
      expect(action).toHaveBeenCalledWith(
        expect.any(Object), // context
        { data: 'test' }     // event data
      );
    });
    
    it('should execute entry and exit actions', async () => {
      const onEntry = vi.fn();
      const onExit = vi.fn();
      
      const actionStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { from: TestState.IDLE, to: TestState.LOADING, event: TestEvent.START }
        ],
        onEntry: {
          [TestState.LOADING]: onEntry
        },
        onExit: {
          [TestState.IDLE]: onExit
        }
      });
      
      await actionStateMachine.transition(TestEvent.START);
      
      expect(onExit).toHaveBeenCalledWith(expect.any(Object), TestState.LOADING);
      expect(onEntry).toHaveBeenCalledWith(expect.any(Object), TestState.IDLE);
    });
    
    it('should handle async actions', async () => {
      let actionCompleted = false;
      
      const asyncAction = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        actionCompleted = true;
      });
      
      const asyncStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { 
            from: TestState.IDLE, 
            to: TestState.LOADING, 
            event: TestEvent.START,
            action: asyncAction
          }
        ]
      });
      
      await asyncStateMachine.transition(TestEvent.START);
      
      expect(asyncAction).toHaveBeenCalled();
      expect(actionCompleted).toBe(true);
      expect(asyncStateMachine.getState()).toBe(TestState.LOADING);
    });
  });
  
  describe('History and Events', () => {
    it('should track state change history', async () => {
      await stateMachine.transition(TestEvent.START);
      await stateMachine.transition(TestEvent.SUCCESS);
      
      const history = stateMachine.getHistory();
      expect(history.length).toBe(2);
      
      expect(history[0]).toEqual({
        fromState: TestState.IDLE,
        toState: TestState.LOADING,
        event: TestEvent.START,
        timestamp: expect.any(Number)
      });
      
      expect(history[1]).toEqual({
        fromState: TestState.LOADING,
        toState: TestState.READY,
        event: TestEvent.SUCCESS,
        timestamp: expect.any(Number)
      });
    });
    
    it('should clear history', async () => {
      await stateMachine.transition(TestEvent.START);
      expect(stateMachine.getHistory().length).toBe(1);
      
      stateMachine.clearHistory();
      expect(stateMachine.getHistory().length).toBe(0);
    });
    
    it('should notify state change listeners', async () => {
      const listener = vi.fn();
      
      const unsubscribe = stateMachine.onStateChange(listener);
      await stateMachine.transition(TestEvent.START);
      
      expect(listener).toHaveBeenCalledWith({
        fromState: TestState.IDLE,
        toState: TestState.LOADING,
        event: TestEvent.START,
        timestamp: expect.any(Number)
      });
      
      unsubscribe();
      await stateMachine.transition(TestEvent.SUCCESS);
      expect(listener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors in actions', async () => {
      const onError = vi.fn();
      
      const faultyStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { 
            from: TestState.IDLE, 
            to: TestState.LOADING, 
            event: TestEvent.START,
            action: () => {
              throw new Error('Action failed');
            }
          }
        ],
        onError
      });
      
      const success = await faultyStateMachine.transition(TestEvent.START);
      
      expect(success).toBe(false);
      expect(faultyStateMachine.getState()).toBe(TestState.IDLE); // State unchanged
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        TestState.IDLE,
        TestEvent.START,
        expect.any(Object)
      );
    });
    
    it('should handle errors in entry/exit actions', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const faultyStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { from: TestState.IDLE, to: TestState.LOADING, event: TestEvent.START }
        ],
        onEntry: {
          [TestState.LOADING]: () => {
            throw new Error('Entry action failed');
          }
        }
      });
      
      const success = await faultyStateMachine.transition(TestEvent.START);
      
      expect(success).toBe(false);
      expect(faultyStateMachine.getState()).toBe(TestState.IDLE);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in state transition:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Reset', () => {
    it('should reset to initial state', async () => {
      await stateMachine.transition(TestEvent.START);
      await stateMachine.transition(TestEvent.SUCCESS);
      
      expect(stateMachine.getState()).toBe(TestState.READY);
      
      await stateMachine.reset();
      
      expect(stateMachine.getState()).toBe(TestState.IDLE);
      expect(stateMachine.getContext()).toEqual({});
    });
    
    it('should execute exit/entry actions on reset', async () => {
      const onExit = vi.fn();
      const onEntry = vi.fn();
      
      const resetStateMachine = new StateMachine({
        initialState: TestState.IDLE,
        transitions: [
          { from: TestState.IDLE, to: TestState.READY, event: TestEvent.START }
        ],
        onExit: {
          [TestState.READY]: onExit
        },
        onEntry: {
          [TestState.IDLE]: onEntry
        }
      });
      
      await resetStateMachine.transition(TestEvent.START);
      await resetStateMachine.reset();
      
      expect(onExit).toHaveBeenCalledWith(expect.any(Object), TestState.IDLE);
      expect(onEntry).toHaveBeenCalledWith(expect.any(Object), TestState.READY);
    });
  });
});

describe('AppStateMachineFactory', () => {
  let appStateMachine: StateMachine<AppState, AppEvent>;
  
  beforeEach(() => {
    appStateMachine = AppStateMachineFactory.create();
  });
  
  it('should create app state machine in idle state', () => {
    expect(appStateMachine.getState()).toBe(AppState.IDLE);
  });
  
  it('should handle file loading workflow', async () => {
    expect(appStateMachine.getState()).toBe(AppState.IDLE);
    
    // Start loading
    await appStateMachine.transition(AppEvent.LOAD_FILE, { file: new File([], 'test.dxf') });
    expect(appStateMachine.getState()).toBe(AppState.LOADING);
    
    // Loading success
    await appStateMachine.transition(AppEvent.LOAD_SUCCESS, { shapes: [], geometries: [] });
    expect(appStateMachine.getState()).toBe(AppState.LOADED);
  });
  
  it('should handle error and retry workflow', async () => {
    // Go to loading state
    await appStateMachine.transition(AppEvent.LOAD_FILE);
    expect(appStateMachine.getState()).toBe(AppState.LOADING);
    
    // Error occurs
    await appStateMachine.transition(AppEvent.LOAD_ERROR, { error: new Error('Load failed') });
    expect(appStateMachine.getState()).toBe(AppState.ERROR);
    
    // Retry (should go back to loading state based on previous state)
    await appStateMachine.transition(AppEvent.RETRY);
    expect(appStateMachine.getState()).toBe(AppState.LOADING);
  });
  
  it('should handle modify workflow', async () => {
    // Get to loaded state first
    await appStateMachine.transition(AppEvent.LOAD_FILE);
    await appStateMachine.transition(AppEvent.LOAD_SUCCESS);
    
    expect(appStateMachine.getState()).toBe(AppState.LOADED);
    
    // Start modifying
    await appStateMachine.transition(AppEvent.START_MODIFY);
    expect(appStateMachine.getState()).toBe(AppState.MODIFYING);
    
    // Finish modifying
    await appStateMachine.transition(AppEvent.FINISH_MODIFY);
    expect(appStateMachine.getState()).toBe(AppState.LOADED);
  });
  
  it('should handle programming workflow', async () => {
    // Get to loaded state
    await appStateMachine.transition(AppEvent.LOAD_FILE);
    await appStateMachine.transition(AppEvent.LOAD_SUCCESS);
    
    // Start programming
    await appStateMachine.transition(AppEvent.START_PROGRAM);
    expect(appStateMachine.getState()).toBe(AppState.PROGRAMMING);
    
    // Start export
    await appStateMachine.transition(AppEvent.START_EXPORT);
    expect(appStateMachine.getState()).toBe(AppState.EXPORTING);
    
    // Finish export
    await appStateMachine.transition(AppEvent.FINISH_EXPORT);
    expect(appStateMachine.getState()).toBe(AppState.PROGRAMMING);
  });
  
  it('should handle global reset', async () => {
    // Get to some advanced state
    await appStateMachine.transition(AppEvent.LOAD_FILE);
    await appStateMachine.transition(AppEvent.LOAD_SUCCESS);
    await appStateMachine.transition(AppEvent.START_MODIFY);
    
    expect(appStateMachine.getState()).toBe(AppState.MODIFYING);
    
    // Reset to idle
    await appStateMachine.transition(AppEvent.RESET);
    expect(appStateMachine.getState()).toBe(AppState.IDLE);
  });
  
  it('should prevent invalid transitions', async () => {
    expect(appStateMachine.getState()).toBe(AppState.IDLE);
    
    // Can't start modifying from idle
    const success = await appStateMachine.transition(AppEvent.START_MODIFY);
    expect(success).toBe(false);
    expect(appStateMachine.getState()).toBe(AppState.IDLE);
  });
  
  it('should use guards for retry transitions', async () => {
    // Go to error state from loading
    await appStateMachine.transition(AppEvent.LOAD_FILE);
    await appStateMachine.transition(AppEvent.LOAD_ERROR);
    
    const context: AppContext = { previousState: AppState.LOADING };
    appStateMachine.setContext(context);
    
    expect(appStateMachine.getState()).toBe(AppState.ERROR);
    
    // Retry should go back to previous state
    await appStateMachine.transition(AppEvent.RETRY);
    expect(appStateMachine.getState()).toBe(AppState.LOADING);
  });
});

describe('StateMachineBuilder', () => {
  it('should build state machine using builder pattern', () => {
    const stateMachine = new StateMachineBuilder<TestState, TestEvent>()
      .withInitialState(TestState.IDLE)
      .addTransition(TestState.IDLE, TestState.LOADING, TestEvent.START)
      .addTransition(TestState.LOADING, TestState.READY, TestEvent.SUCCESS)
      .addEntryAction(TestState.LOADING, (context) => {
        context.loadingStarted = Date.now();
      })
      .withErrorHandler((error, state, event, context) => {
        context.lastError = error;
      })
      .build();
    
    expect(stateMachine.getState()).toBe(TestState.IDLE);
    expect(stateMachine.canTransition(TestEvent.START)).toBe(true);
  });
  
  it('should throw error if initial state not set', () => {
    expect(() => {
      new StateMachineBuilder()
        .addTransition('a', 'b', 'event')
        .build();
    }).toThrow('Initial state must be set');
  });
  
  it('should handle guards and actions in builder', async () => {
    let actionCalled = false;
    
    const stateMachine = new StateMachineBuilder<TestState, TestEvent>()
      .withInitialState(TestState.IDLE)
      .addTransition(TestState.IDLE, TestState.LOADING, TestEvent.START, {
        guard: (context) => context.canStart === true,
        action: () => { actionCalled = true; }
      })
      .build();
    
    // Should fail without guard condition
    let success = await stateMachine.transition(TestEvent.START);
    expect(success).toBe(false);
    expect(actionCalled).toBe(false);
    
    // Should succeed with guard condition
    stateMachine.setContext({ canStart: true });
    success = await stateMachine.transition(TestEvent.START);
    expect(success).toBe(true);
    expect(actionCalled).toBe(true);
  });
});