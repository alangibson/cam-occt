/**
 * Dependency injection container for service management
 * Provides centralized service registration and resolution with lifecycle management
 */

export type ServiceLifecycle = 'singleton' | 'transient' | 'scoped';

export interface ServiceDefinition<T = any> {
  factory: (...dependencies: any[]) => T | Promise<T>;
  dependencies?: string[];
  lifecycle: ServiceLifecycle;
  scope?: string;
}

export interface ServiceMetadata {
  name: string;
  lifecycle: ServiceLifecycle;
  scope?: string;
  dependencies: string[];
  isRegistered: boolean;
  isInitialized: boolean;
}

export interface ContainerOptions {
  /**
   * Whether to automatically resolve circular dependencies
   */
  enableCircularDependencyDetection?: boolean;
  
  /**
   * Maximum depth for dependency resolution
   */
  maxResolutionDepth?: number;
  
  /**
   * Whether to log service operations
   */
  enableLogging?: boolean;
}

/**
 * Dependency injection container with lifecycle management
 */
export class ServiceContainer {
  private readonly services = new Map<string, ServiceDefinition>();
  private readonly singletonInstances = new Map<string, any>();
  private readonly scopedInstances = new Map<string, Map<string, any>>();
  private readonly resolutionStack: string[] = [];
  private currentScope: string | null = null;
  
  private readonly options: Required<ContainerOptions>;
  
  constructor(options: ContainerOptions = {}) {
    this.options = {
      enableCircularDependencyDetection: options.enableCircularDependencyDetection ?? true,
      maxResolutionDepth: options.maxResolutionDepth ?? 20,
      enableLogging: options.enableLogging ?? false
    };
  }
  
  /**
   * Register a singleton service
   */
  registerSingleton<T>(
    name: string, 
    factory: (...dependencies: any[]) => T | Promise<T>,
    dependencies: string[] = []
  ): this {
    return this.register(name, factory, dependencies, 'singleton');
  }
  
  /**
   * Register a transient service (new instance every time)
   */
  registerTransient<T>(
    name: string,
    factory: (...dependencies: any[]) => T | Promise<T>,
    dependencies: string[] = []
  ): this {
    return this.register(name, factory, dependencies, 'transient');
  }
  
  /**
   * Register a scoped service (one instance per scope)
   */
  registerScoped<T>(
    name: string,
    factory: (...dependencies: any[]) => T | Promise<T>,
    dependencies: string[] = [],
    scope?: string
  ): this {
    return this.register(name, factory, dependencies, 'scoped', scope);
  }
  
  /**
   * Register a service with explicit lifecycle
   */
  register<T>(
    name: string,
    factory: (...dependencies: any[]) => T | Promise<T>,
    dependencies: string[] = [],
    lifecycle: ServiceLifecycle = 'singleton',
    scope?: string
  ): this {
    if (this.services.has(name)) {
      throw new Error(`Service '${name}' is already registered`);
    }
    
    this.services.set(name, {
      factory,
      dependencies,
      lifecycle,
      scope
    });
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Registered ${lifecycle} service: ${name}`);
    }
    
    return this;
  }
  
  /**
   * Register a service instance (automatically singleton)
   */
  registerInstance<T>(name: string, instance: T): this {
    this.registerSingleton(name, () => instance, []);
    this.singletonInstances.set(name, instance);
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Registered instance: ${name}`);
    }
    
    return this;
  }
  
  /**
   * Get a service instance
   */
  async get<T>(name: string): Promise<T> {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }
    
    return this.resolveService<T>(name, service);
  }
  
  /**
   * Get a service instance synchronously (throws if service is async)
   */
  getSync<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' is not registered`);
    }
    
    const result = this.resolveServiceSync<T>(name, service);
    return result;
  }
  
  /**
   * Check if a service is registered
   */
  isRegistered(name: string): boolean {
    return this.services.has(name);
  }
  
  /**
   * Get service metadata
   */
  getServiceMetadata(name: string): ServiceMetadata | null {
    const service = this.services.get(name);
    if (!service) {
      return null;
    }
    
    const isInitialized = service.lifecycle === 'singleton' 
      ? this.singletonInstances.has(name)
      : false;
    
    return {
      name,
      lifecycle: service.lifecycle,
      scope: service.scope,
      dependencies: service.dependencies || [],
      isRegistered: true,
      isInitialized
    };
  }
  
  /**
   * Get all registered service names
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }
  
  /**
   * Create a new scope for scoped services
   */
  createScope(scopeId: string): ScopedContainer {
    if (!this.scopedInstances.has(scopeId)) {
      this.scopedInstances.set(scopeId, new Map());
    }
    
    return new ScopedContainer(this, scopeId);
  }
  
  /**
   * Dispose a scope and its services
   */
  disposeScope(scopeId: string): void {
    const scopeInstances = this.scopedInstances.get(scopeId);
    if (!scopeInstances) {
      return;
    }
    
    // Dispose instances that implement IDisposable
    for (const [serviceName, instance] of scopeInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`Error disposing service '${serviceName}':`, error);
        }
      }
    }
    
    this.scopedInstances.delete(scopeId);
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Disposed scope: ${scopeId}`);
    }
  }
  
  /**
   * Clear all singletons (useful for testing)
   */
  clearSingletons(): void {
    // Dispose singletons that implement IDisposable
    for (const [serviceName, instance] of this.singletonInstances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose();
        } catch (error) {
          console.error(`Error disposing singleton '${serviceName}':`, error);
        }
      }
    }
    
    this.singletonInstances.clear();
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Cleared all singletons`);
    }
  }
  
  /**
   * Clear all services and instances
   */
  clear(): void {
    this.clearSingletons();
    
    // Dispose all scoped instances
    for (const scopeId of this.scopedInstances.keys()) {
      this.disposeScope(scopeId);
    }
    
    this.services.clear();
    this.resolutionStack.length = 0;
    this.currentScope = null;
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Cleared all services`);
    }
  }
  
  /**
   * Validate all service dependencies
   */
  validateDependencies(): void {
    const errors: string[] = [];
    
    for (const [serviceName, service] of this.services) {
      for (const dependency of service.dependencies || []) {
        if (!this.services.has(dependency)) {
          errors.push(`Service '${serviceName}' depends on unregistered service '${dependency}'`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Dependency validation failed:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * Resolve service instance with lifecycle management
   */
  private async resolveService<T>(name: string, service: ServiceDefinition): Promise<T> {
    // Check for circular dependencies
    if (this.options.enableCircularDependencyDetection && this.resolutionStack.includes(name)) {
      throw new Error(`Circular dependency detected: ${this.resolutionStack.join(' -> ')} -> ${name}`);
    }
    
    // Check resolution depth
    if (this.resolutionStack.length >= this.options.maxResolutionDepth) {
      throw new Error(`Maximum resolution depth exceeded: ${this.resolutionStack.join(' -> ')}`);
    }
    
    this.resolutionStack.push(name);
    
    try {
      let instance: T;
      
      switch (service.lifecycle) {
        case 'singleton':
          instance = await this.resolveSingleton<T>(name, service);
          break;
        case 'transient':
          instance = await this.resolveTransient<T>(name, service);
          break;
        case 'scoped':
          instance = await this.resolveScoped<T>(name, service);
          break;
        default:
          throw new Error(`Unknown lifecycle: ${service.lifecycle}`);
      }
      
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }
  
  /**
   * Resolve service instance synchronously
   */
  private resolveServiceSync<T>(name: string, service: ServiceDefinition): T {
    // Check for circular dependencies
    if (this.options.enableCircularDependencyDetection && this.resolutionStack.includes(name)) {
      throw new Error(`Circular dependency detected: ${this.resolutionStack.join(' -> ')} -> ${name}`);
    }
    
    this.resolutionStack.push(name);
    
    try {
      let instance: T;
      
      switch (service.lifecycle) {
        case 'singleton':
          instance = this.resolveSingletonSync<T>(name, service);
          break;
        case 'transient':
          instance = this.resolveTransientSync<T>(name, service);
          break;
        case 'scoped':
          instance = this.resolveScopedSync<T>(name, service);
          break;
        default:
          throw new Error(`Unknown lifecycle: ${service.lifecycle}`);
      }
      
      return instance;
    } finally {
      this.resolutionStack.pop();
    }
  }
  
  private async resolveSingleton<T>(name: string, service: ServiceDefinition): Promise<T> {
    if (this.singletonInstances.has(name)) {
      return this.singletonInstances.get(name);
    }
    
    const dependencies = await this.resolveDependencies(service.dependencies || []);
    const instance = await service.factory(...dependencies);
    
    this.singletonInstances.set(name, instance);
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Created singleton: ${name}`);
    }
    
    return instance;
  }
  
  private resolveSingletonSync<T>(name: string, service: ServiceDefinition): T {
    if (this.singletonInstances.has(name)) {
      return this.singletonInstances.get(name);
    }
    
    const dependencies = this.resolveDependenciesSync(service.dependencies || []);
    const instance = service.factory(...dependencies);
    
    if (instance && typeof instance.then === 'function') {
      throw new Error(`Service '${name}' factory returns a promise but was called synchronously`);
    }
    
    this.singletonInstances.set(name, instance);
    return instance as T;
  }
  
  private async resolveTransient<T>(name: string, service: ServiceDefinition): Promise<T> {
    const dependencies = await this.resolveDependencies(service.dependencies || []);
    const instance = await service.factory(...dependencies);
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Created transient: ${name}`);
    }
    
    return instance;
  }
  
  private resolveTransientSync<T>(name: string, service: ServiceDefinition): T {
    const dependencies = this.resolveDependenciesSync(service.dependencies || []);
    const instance = service.factory(...dependencies);
    
    if (instance && typeof instance.then === 'function') {
      throw new Error(`Service '${name}' factory returns a promise but was called synchronously`);
    }
    
    return instance as T;
  }
  
  private async resolveScoped<T>(name: string, service: ServiceDefinition): Promise<T> {
    const scopeId = this.currentScope || service.scope || 'default';
    
    if (!this.scopedInstances.has(scopeId)) {
      this.scopedInstances.set(scopeId, new Map());
    }
    
    const scopeMap = this.scopedInstances.get(scopeId)!;
    
    if (scopeMap.has(name)) {
      return scopeMap.get(name);
    }
    
    const dependencies = await this.resolveDependencies(service.dependencies || []);
    const instance = await service.factory(...dependencies);
    
    scopeMap.set(name, instance);
    
    if (this.options.enableLogging) {
      console.log(`[ServiceContainer] Created scoped: ${name} (scope: ${scopeId})`);
    }
    
    return instance;
  }
  
  private resolveScopedSync<T>(name: string, service: ServiceDefinition): T {
    const scopeId = this.currentScope || service.scope || 'default';
    
    if (!this.scopedInstances.has(scopeId)) {
      this.scopedInstances.set(scopeId, new Map());
    }
    
    const scopeMap = this.scopedInstances.get(scopeId)!;
    
    if (scopeMap.has(name)) {
      return scopeMap.get(name);
    }
    
    const dependencies = this.resolveDependenciesSync(service.dependencies || []);
    const instance = service.factory(...dependencies);
    
    if (instance && typeof instance.then === 'function') {
      throw new Error(`Service '${name}' factory returns a promise but was called synchronously`);
    }
    
    scopeMap.set(name, instance);
    return instance as T;
  }
  
  private async resolveDependencies(dependencies: string[]): Promise<any[]> {
    const promises = dependencies.map(dep => this.get(dep));
    return Promise.all(promises);
  }
  
  private resolveDependenciesSync(dependencies: string[]): any[] {
    return dependencies.map(dep => this.getSync(dep));
  }
  
  /**
   * Set current scope for scoped service resolution
   */
  setCurrentScope(scopeId: string | null): void {
    this.currentScope = scopeId;
  }
}

/**
 * Scoped container for managing scoped services
 */
export class ScopedContainer {
  constructor(
    private readonly parentContainer: ServiceContainer,
    private readonly scopeId: string
  ) {
    this.parentContainer.setCurrentScope(scopeId);
  }
  
  async get<T>(name: string): Promise<T> {
    return this.parentContainer.get<T>(name);
  }
  
  getSync<T>(name: string): T {
    return this.parentContainer.getSync<T>(name);
  }
  
  dispose(): void {
    this.parentContainer.disposeScope(this.scopeId);
    this.parentContainer.setCurrentScope(null);
  }
}

/**
 * Interface for services that need cleanup
 */
export interface IDisposable {
  dispose(): void | Promise<void>;
}

/**
 * Factory for creating common container configurations
 */
export class ContainerFactory {
  /**
   * Create a container with development settings (logging enabled)
   */
  static createDevelopment(): ServiceContainer {
    return new ServiceContainer({
      enableCircularDependencyDetection: true,
      enableLogging: true,
      maxResolutionDepth: 20
    });
  }
  
  /**
   * Create a container with production settings (optimized performance)
   */
  static createProduction(): ServiceContainer {
    return new ServiceContainer({
      enableCircularDependencyDetection: false,
      enableLogging: false,
      maxResolutionDepth: 50
    });
  }
  
  /**
   * Create a container for testing (easy cleanup)
   */
  static createTesting(): ServiceContainer {
    return new ServiceContainer({
      enableCircularDependencyDetection: true,
      enableLogging: false,
      maxResolutionDepth: 10
    });
  }
}