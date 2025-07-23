/**
 * Command pattern implementation with transaction boundaries
 * Provides atomic operations with rollback capability
 */

export interface Command {
  /**
   * Execute the command
   * @throws Error if command cannot be executed
   */
  execute(): Promise<void>;
  
  /**
   * Undo the command (rollback changes)
   * @throws Error if command cannot be undone
   */
  undo(): Promise<void>;
  
  /**
   * Check if command can be executed in current state
   */
  canExecute(): boolean;
  
  /**
   * Get command description for logging/debugging
   */
  getDescription(): string;
}

export interface CommandState {
  [key: string]: any;
}

/**
 * Base class for implementing commands with state capture
 */
export abstract class BaseCommand implements Command {
  protected originalState: CommandState | null = null;
  
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract canExecute(): boolean;
  abstract getDescription(): string;
  
  /**
   * Capture current state before executing command
   */
  protected abstract captureState(): CommandState;
  
  /**
   * Restore state from captured snapshot
   */
  protected abstract restoreState(state: CommandState): Promise<void>;
}

/**
 * Transaction manager for executing multiple commands atomically
 * If any command fails, all executed commands are rolled back
 */
export class TransactionManager {
  private readonly executedCommands: Command[] = [];
  
  /**
   * Execute multiple commands in a transaction
   * All commands succeed or all are rolled back
   */
  async executeTransaction(commands: Command[]): Promise<void> {
    // Validate all commands can be executed
    for (const command of commands) {
      if (!command.canExecute()) {
        throw new Error(`Command cannot be executed: ${command.getDescription()}`);
      }
    }
    
    // Execute commands in order
    for (const command of commands) {
      try {
        await command.execute();
        this.executedCommands.push(command);
      } catch (error) {
        // Rollback all executed commands in reverse order
        await this.rollback();
        throw new Error(`Transaction failed at command "${command.getDescription()}": ${error}`);
      }
    }
    
    // Clear executed commands on success
    this.executedCommands.length = 0;
  }
  
  /**
   * Execute a single command with automatic rollback on failure
   */
  async executeCommand(command: Command): Promise<void> {
    return this.executeTransaction([command]);
  }
  
  /**
   * Rollback all executed commands in reverse order
   */
  private async rollback(): Promise<void> {
    const errors: Error[] = [];
    
    // Undo commands in reverse order
    for (let i = this.executedCommands.length - 1; i >= 0; i--) {
      try {
        await this.executedCommands[i].undo();
      } catch (error) {
        errors.push(new Error(`Failed to undo command "${this.executedCommands[i].getDescription()}": ${error}`));
      }
    }
    
    // Clear executed commands
    this.executedCommands.length = 0;
    
    // Report rollback errors
    if (errors.length > 0) {
      throw new Error(`Rollback completed with errors: ${errors.map(e => e.message).join('; ')}`);
    }
  }
}

/**
 * Command factory for creating common command types
 */
export class CommandFactory {
  /**
   * Create a simple function-based command
   */
  static createFunctionCommand(
    executeFn: () => Promise<void>,
    undoFn: () => Promise<void>,
    canExecuteFn: () => boolean = () => true,
    description: string = 'Function command'
  ): Command {
    return {
      execute: executeFn,
      undo: undoFn,
      canExecute: canExecuteFn,
      getDescription: () => description
    };
  }
  
  /**
   * Create a no-op command (useful for testing)
   */
  static createNoOpCommand(description: string = 'No-op command'): Command {
    return {
      execute: async () => {},
      undo: async () => {},
      canExecute: () => true,
      getDescription: () => description
    };
  }
}