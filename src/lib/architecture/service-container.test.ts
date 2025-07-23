import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceContainer, ScopedContainer, IDisposable, ContainerFactory } from './service-container';

// Mock services for testing
interface ILogger {
  log(message: string): void;
}

class MockLogger implements ILogger {
  public logs: string[] = [];
  
  log(message: string): void {
    this.logs.push(message);
  }
}

interface IDatabase {
  query(sql: string): any[];
}

class MockDatabase implements IDatabase, IDisposable {
  public disposed = false;
  
  query(sql: string): any[] {
    return [{ result: sql }];
  }
  
  dispose(): void {
    this.disposed = true;
  }
}

interface IUserService {
  getUser(id: number): { id: number; name: string };
}

class MockUserService implements IUserService {
  constructor(
    private logger: ILogger,
    private database: IDatabase
  ) {}
  
  getUser(id: number): { id: number; name: string } {
    this.logger.log(`Getting user ${id}`);
    this.database.query(`SELECT * FROM users WHERE id = ${id}`);
    return { id, name: `User ${id}` };
  }
}

describe('ServiceContainer', () => {
  let container: ServiceContainer;
  
  beforeEach(() => {
    container = new ServiceContainer();
  });
  
  describe('Service Registration', () => {
    it('should register singleton services', () => {
      container.registerSingleton('logger', () => new MockLogger());
      
      expect(container.isRegistered('logger')).toBe(true);
      expect(container.getRegisteredServices()).toContain('logger');
    });
    
    it('should register transient services', () => {
      container.registerTransient('logger', () => new MockLogger());
      
      const metadata = container.getServiceMetadata('logger');
      expect(metadata?.lifecycle).toBe('transient');
    });
    
    it('should register scoped services', () => {
      container.registerScoped('database', () => new MockDatabase(), [], 'test-scope');
      
      const metadata = container.getServiceMetadata('database');
      expect(metadata?.lifecycle).toBe('scoped');
      expect(metadata?.scope).toBe('test-scope');
    });
    
    it('should register service instances', () => {
      const loggerInstance = new MockLogger();
      container.registerInstance('logger', loggerInstance);
      
      const retrieved = container.getSync<ILogger>('logger');
      expect(retrieved).toBe(loggerInstance);
    });
    
    it('should register services with dependencies', () => {
      container.registerSingleton('logger', () => new MockLogger());
      container.registerSingleton('database', () => new MockDatabase());
      container.registerSingleton('userService', 
        (logger: ILogger, database: IDatabase) => new MockUserService(logger, database),
        ['logger', 'database']
      );
      
      const metadata = container.getServiceMetadata('userService');
      expect(metadata?.dependencies).toEqual(['logger', 'database']);
    });
    
    it('should throw error when registering duplicate service', () => {
      container.registerSingleton('logger', () => new MockLogger());
      
      expect(() => {
        container.registerSingleton('logger', () => new MockLogger());
      }).toThrow("Service 'logger' is already registered");
    });
    
    it('should throw error when getting unregistered service', async () => {
      await expect(container.get('nonexistent')).rejects.toThrow(
        "Service 'nonexistent' is not registered"
      );
    });
  });
  
  describe('Singleton Lifecycle', () => {
    it('should return same instance for singleton services', async () => {
      container.registerSingleton('logger', () => new MockLogger());
      
      const instance1 = await container.get<ILogger>('logger');
      const instance2 = await container.get<ILogger>('logger');
      
      expect(instance1).toBe(instance2);
    });
    
    it('should create singleton with dependencies', async () => {
      container.registerSingleton('logger', () => new MockLogger());
      container.registerSingleton('database', () => new MockDatabase());
      container.registerSingleton('userService', 
        (logger: ILogger, database: IDatabase) => new MockUserService(logger, database),
        ['logger', 'database']
      );
      
      const userService = await container.get<IUserService>('userService');
      const user = userService.getUser(123);
      
      expect(user.id).toBe(123);
      expect(user.name).toBe('User 123');
      
      // Check that dependencies were injected
      const logger = await container.get<MockLogger>('logger');
      expect(logger.logs).toContain('Getting user 123');
    });
  });
  
  describe('Transient Lifecycle', () => {
    it('should return new instance for transient services', async () => {
      container.registerTransient('logger', () => new MockLogger());
      
      const instance1 = await container.get<ILogger>('logger');
      const instance2 = await container.get<ILogger>('logger');
      
      expect(instance1).not.toBe(instance2);
    });
  });
  
  describe('Scoped Lifecycle', () => {
    it('should return same instance within scope', async () => {
      container.registerScoped('database', () => new MockDatabase());
      
      const scope1 = container.createScope('scope1');
      const scope2 = container.createScope('scope2');
      
      const db1a = await scope1.get<IDatabase>('database');
      const db1b = await scope1.get<IDatabase>('database');
      const db2 = await scope2.get<IDatabase>('database');
      
      expect(db1a).toBe(db1b); // Same within scope
      expect(db1a).not.toBe(db2); // Different across scopes
      
      scope1.dispose();
      scope2.dispose();
    });
    
    it('should dispose scoped instances when scope is disposed', () => {
      container.registerScoped('database', () => new MockDatabase());
      
      const scope = container.createScope('test-scope');
      const database = scope.getSync<MockDatabase>('database');
      
      expect(database.disposed).toBe(false);
      
      scope.dispose();
      expect(database.disposed).toBe(true);
    });
    
    it('should dispose scope instances when container disposes scope', () => {
      container.registerScoped('database', () => new MockDatabase());
      
      const scope = container.createScope('test-scope');
      const database = scope.getSync<MockDatabase>('database');
      
      expect(database.disposed).toBe(false);
      
      container.disposeScope('test-scope');
      expect(database.disposed).toBe(true);
    });
  });
  
  describe('Synchronous Resolution', () => {
    it('should resolve services synchronously', () => {
      container.registerSingleton('logger', () => new MockLogger());
      
      const logger = container.getSync<ILogger>('logger');
      expect(logger).toBeInstanceOf(MockLogger);
    });
    
    it('should throw error for async factories in sync resolution', () => {
      container.registerSingleton('async-service', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return new MockLogger();
      });
      
      expect(() => {
        container.getSync('async-service');
      }).toThrow('returns a promise but was called synchronously');
    });
  });
  
  describe('Dependency Resolution', () => {
    it('should resolve complex dependency chains', async () => {
      container.registerSingleton('logger', () => new MockLogger());
      container.registerTransient('database', () => new MockDatabase());
      container.registerSingleton('userService',
        (logger: ILogger, database: IDatabase) => new MockUserService(logger, database),
        ['logger', 'database']
      );
      
      const userService = await container.get<MockUserService>('userService');
      const user = userService.getUser(456);
      
      expect(user.name).toBe('User 456');
      
      const logger = await container.get<MockLogger>('logger');
      expect(logger.logs).toContain('Getting user 456');
    });
    
    it('should detect circular dependencies', async () => {
      container.registerSingleton('serviceA', 
        (serviceB: any) => ({ name: 'A', dependency: serviceB }),
        ['serviceB']
      );
      
      container.registerSingleton('serviceB',
        (serviceA: any) => ({ name: 'B', dependency: serviceA }),
        ['serviceA']
      );
      
      await expect(container.get('serviceA')).rejects.toThrow(
        'Circular dependency detected'
      );
    });
    
    it('should validate dependencies', () => {
      container.registerSingleton('userService',
        (logger: ILogger) => new MockUserService(logger, new MockDatabase()),
        ['logger'] // logger is not registered
      );
      
      expect(() => {
        container.validateDependencies();
      }).toThrow("depends on unregistered service 'logger'");
    });
    
    it('should prevent infinite recursion with max depth', async () => {
      const container = new ServiceContainer({ maxResolutionDepth: 3 });
      
      // Create a chain of dependencies longer than max depth
      for (let i = 0; i < 5; i++) {
        const deps = i === 0 ? [] : [`service${i - 1}`];
        container.registerSingleton(`service${i}`, 
          (dep?: any) => ({ name: `Service${i}`, dep }),
          deps
        );
      }
      
      await expect(container.get('service4')).rejects.toThrow(
        'Maximum resolution depth exceeded'
      );
    });
  });
  
  describe('Service Metadata', () => {
    it('should provide service metadata', () => {
      container.registerSingleton('logger', () => new MockLogger(), [], 'singleton');
      
      const metadata = container.getServiceMetadata('logger');
      expect(metadata).toEqual({
        name: 'logger',
        lifecycle: 'singleton',
        scope: undefined,
        dependencies: [],
        isRegistered: true,
        isInitialized: false
      });
    });
    
    it('should return null for non-existent service metadata', () => {
      const metadata = container.getServiceMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
    
    it('should track initialization status', async () => {
      container.registerSingleton('logger', () => new MockLogger());
      
      let metadata = container.getServiceMetadata('logger');
      expect(metadata?.isInitialized).toBe(false);
      
      await container.get('logger');
      
      metadata = container.getServiceMetadata('logger');
      expect(metadata?.isInitialized).toBe(true);
    });
  });
  
  describe('Container Management', () => {
    it('should clear singletons', async () => {
      container.registerSingleton('database', () => new MockDatabase());
      
      const database = await container.get<MockDatabase>('database');
      expect(database.disposed).toBe(false);
      
      container.clearSingletons();
      expect(database.disposed).toBe(true);
      
      // Should create new instance after clear
      const newDatabase = await container.get<MockDatabase>('database');
      expect(newDatabase).not.toBe(database);
    });
    
    it('should clear all services', () => {
      container.registerSingleton('logger', () => new MockLogger());
      container.registerTransient('database', () => new MockDatabase());
      
      expect(container.getRegisteredServices().length).toBe(2);
      
      container.clear();
      
      expect(container.getRegisteredServices().length).toBe(0);
    });
  });
  
  describe('Async Services', () => {
    it('should handle async service factories', async () => {
      container.registerSingleton('asyncService', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return new MockLogger();
      });
      
      const service = await container.get<ILogger>('asyncService');
      expect(service).toBeInstanceOf(MockLogger);
    });
    
    it('should handle mixed sync and async dependencies', async () => {
      container.registerSingleton('syncLogger', () => new MockLogger());
      container.registerSingleton('asyncDatabase', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return new MockDatabase();
      });
      
      container.registerSingleton('userService',
        (logger: ILogger, database: IDatabase) => new MockUserService(logger, database),
        ['syncLogger', 'asyncDatabase']
      );
      
      const userService = await container.get<IUserService>('userService');
      expect(userService).toBeInstanceOf(MockUserService);
    });
  });
});

describe('ScopedContainer', () => {
  let container: ServiceContainer;
  
  beforeEach(() => {
    container = new ServiceContainer();
  });
  
  it('should provide scoped access to services', async () => {
    container.registerScoped('database', () => new MockDatabase());
    
    const scope = container.createScope('test');
    const database = await scope.get<IDatabase>('database');
    
    expect(database).toBeInstanceOf(MockDatabase);
    
    scope.dispose();
  });
  
  it('should dispose scope on disposal', () => {
    container.registerScoped('database', () => new MockDatabase());
    
    const scope = container.createScope('test');
    const database = scope.getSync<MockDatabase>('database');
    
    expect(database.disposed).toBe(false);
    
    scope.dispose();
    expect(database.disposed).toBe(true);
  });
});

describe('ContainerFactory', () => {
  it('should create development container', () => {
    const container = ContainerFactory.createDevelopment();
    expect(container).toBeInstanceOf(ServiceContainer);
  });
  
  it('should create production container', () => {
    const container = ContainerFactory.createProduction();
    expect(container).toBeInstanceOf(ServiceContainer);
  });
  
  it('should create testing container', () => {
    const container = ContainerFactory.createTesting();
    expect(container).toBeInstanceOf(ServiceContainer);
  });
});

describe('Error Handling', () => {
  let container: ServiceContainer;
  
  beforeEach(() => {
    container = new ServiceContainer();
  });
  
  it('should handle errors in service factories', async () => {
    container.registerSingleton('faultyService', () => {
      throw new Error('Factory error');
    });
    
    await expect(container.get('faultyService')).rejects.toThrow('Factory error');
  });
  
  it('should handle disposal errors gracefully', () => {
    const disposableWithError = {
      dispose: vi.fn(() => {
        throw new Error('Disposal error');
      })
    };
    
    container.registerInstance('faultyDisposable', disposableWithError);
    
    // Should not throw, but log error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    container.clearSingletons();
    
    expect(disposableWithError.dispose).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error disposing singleton'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});