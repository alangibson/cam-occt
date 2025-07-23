import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command, BaseCommand, TransactionManager, CommandFactory, CommandState } from './command';

// Mock command for testing
class MockCommand implements Command {
  public executed = false;
  public undone = false;
  public shouldFailOnExecute = false;
  public shouldFailOnUndo = false;
  public canExecuteResult = true;
  
  constructor(private description: string = 'Mock command') {}
  
  async execute(): Promise<void> {
    if (this.shouldFailOnExecute) {
      throw new Error('Execute failed');
    }
    this.executed = true;
  }
  
  async undo(): Promise<void> {
    if (this.shouldFailOnUndo) {
      throw new Error('Undo failed');
    }
    this.undone = true;
    this.executed = false;
  }
  
  canExecute(): boolean {
    return this.canExecuteResult;
  }
  
  getDescription(): string {
    return this.description;
  }
}

// Mock BaseCommand implementation
class MockBaseCommand extends BaseCommand {
  public state: any = { value: 0 };
  
  constructor(private newValue: number) {
    super();
  }
  
  async execute(): Promise<void> {
    this.originalState = this.captureState();
    this.state.value = this.newValue;
  }
  
  async undo(): Promise<void> {
    if (this.originalState) {
      await this.restoreState(this.originalState);
    }
  }
  
  canExecute(): boolean {
    return true;
  }
  
  getDescription(): string {
    return `Set value to ${this.newValue}`;
  }
  
  protected captureState(): CommandState {
    return { value: this.state.value };
  }
  
  protected async restoreState(state: CommandState): Promise<void> {
    this.state.value = state.value;
  }
}

describe('Command Pattern', () => {
  describe('Command Interface', () => {
    it('should execute and undo commands', async () => {
      const command = new MockCommand();
      
      expect(command.executed).toBe(false);
      expect(command.undone).toBe(false);
      
      await command.execute();
      expect(command.executed).toBe(true);
      
      await command.undo();
      expect(command.undone).toBe(true);
      expect(command.executed).toBe(false);
    });
    
    it('should check if command can execute', () => {
      const command = new MockCommand();
      expect(command.canExecute()).toBe(true);
      
      command.canExecuteResult = false;
      expect(command.canExecute()).toBe(false);
    });
    
    it('should provide command description', () => {
      const command = new MockCommand('Test command');
      expect(command.getDescription()).toBe('Test command');
    });
  });
  
  describe('BaseCommand', () => {
    it('should capture and restore state', async () => {
      const command = new MockBaseCommand(42);
      
      expect(command.state.value).toBe(0);
      
      await command.execute();
      expect(command.state.value).toBe(42);
      
      await command.undo();
      expect(command.state.value).toBe(0);
    });
  });
  
  describe('TransactionManager', () => {
    let transactionManager: TransactionManager;
    
    beforeEach(() => {
      transactionManager = new TransactionManager();
    });
    
    it('should execute single command successfully', async () => {
      const command = new MockCommand();
      
      await transactionManager.executeCommand(command);
      
      expect(command.executed).toBe(true);
      expect(command.undone).toBe(false);
    });
    
    it('should execute multiple commands in transaction', async () => {
      const command1 = new MockCommand('Command 1');
      const command2 = new MockCommand('Command 2');
      const commands = [command1, command2];
      
      await transactionManager.executeTransaction(commands);
      
      expect(command1.executed).toBe(true);
      expect(command2.executed).toBe(true);
      expect(command1.undone).toBe(false);
      expect(command2.undone).toBe(false);
    });
    
    it('should rollback all commands when one fails', async () => {
      const command1 = new MockCommand('Command 1');
      const command2 = new MockCommand('Command 2');
      const command3 = new MockCommand('Command 3');
      
      // Make third command fail
      command3.shouldFailOnExecute = true;
      
      const commands = [command1, command2, command3];
      
      await expect(transactionManager.executeTransaction(commands))
        .rejects.toThrow('Transaction failed at command "Command 3"');
      
      // First two commands should be undone
      expect(command1.executed).toBe(false);
      expect(command2.executed).toBe(false);
      expect(command3.executed).toBe(false);
      
      expect(command1.undone).toBe(true);
      expect(command2.undone).toBe(true);
      expect(command3.undone).toBe(false); // Never executed, so not undone
    });
    
    it('should reject transaction if command cannot execute', async () => {
      const command1 = new MockCommand('Command 1');
      const command2 = new MockCommand('Command 2');
      
      command2.canExecuteResult = false;
      
      const commands = [command1, command2];
      
      await expect(transactionManager.executeTransaction(commands))
        .rejects.toThrow('Command cannot be executed: Command 2');
      
      // No commands should be executed
      expect(command1.executed).toBe(false);
      expect(command2.executed).toBe(false);
    });
    
    it('should handle rollback failures gracefully', async () => {
      const command1 = new MockCommand('Command 1');
      const command2 = new MockCommand('Command 2');
      
      // Make command2 fail on execute and command1 fail on undo
      command2.shouldFailOnExecute = true;
      command1.shouldFailOnUndo = true;
      
      const commands = [command1, command2];
      
      await expect(transactionManager.executeTransaction(commands))
        .rejects.toThrow('Rollback completed with errors');
    });
  });
  
  describe('CommandFactory', () => {
    it('should create function-based commands', async () => {
      let executed = false;
      let undone = false;
      
      const command = CommandFactory.createFunctionCommand(
        async () => { executed = true; },
        async () => { undone = true; executed = false; },
        () => true,
        'Test function command'
      );
      
      expect(command.canExecute()).toBe(true);
      expect(command.getDescription()).toBe('Test function command');
      
      await command.execute();
      expect(executed).toBe(true);
      
      await command.undo();
      expect(undone).toBe(true);
      expect(executed).toBe(false);
    });
    
    it('should create no-op commands', async () => {
      const command = CommandFactory.createNoOpCommand('Test no-op');
      
      expect(command.canExecute()).toBe(true);
      expect(command.getDescription()).toBe('Test no-op');
      
      // Should not throw
      await command.execute();
      await command.undo();
    });
    
    it('should create function command with default parameters', async () => {
      const command = CommandFactory.createFunctionCommand(
        async () => {},
        async () => {}
      );
      
      expect(command.canExecute()).toBe(true);
      expect(command.getDescription()).toBe('Function command');
      
      await command.execute();
      await command.undo();
    });
  });
  
  describe('Error Handling', () => {
    it('should propagate execute errors', async () => {
      const command = new MockCommand();
      command.shouldFailOnExecute = true;
      
      await expect(command.execute()).rejects.toThrow('Execute failed');
    });
    
    it('should propagate undo errors', async () => {
      const command = new MockCommand();
      command.shouldFailOnUndo = true;
      
      await command.execute();
      await expect(command.undo()).rejects.toThrow('Undo failed');
    });
  });
});