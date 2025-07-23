/**
 * Coordinate system management and transformation utilities
 * Provides a single point of control for all coordinate transformations
 */

import * as THREE from 'three';

export interface CoordinateSystemDefinition {
  readonly name: string;
  readonly unitsPerMeter: number;
  readonly transformMatrix: THREE.Matrix4;
  readonly description?: string;
}

export class CoordinateSystem implements CoordinateSystemDefinition {
  constructor(
    public readonly name: string,
    public readonly unitsPerMeter: number,
    public readonly transformMatrix: THREE.Matrix4,
    public readonly description?: string
  ) {}
  
  /**
   * Create a copy of this coordinate system with a new transform matrix
   */
  withTransform(transformMatrix: THREE.Matrix4): CoordinateSystem {
    return new CoordinateSystem(
      this.name,
      this.unitsPerMeter,
      transformMatrix.clone(),
      this.description
    );
  }
  
  /**
   * Create a coordinate system with identity transform
   */
  static createIdentity(name: string, unitsPerMeter: number = 1, description?: string): CoordinateSystem {
    return new CoordinateSystem(name, unitsPerMeter, new THREE.Matrix4(), description);
  }
  
  /**
   * Create a coordinate system with translation
   */
  static createWithTranslation(
    name: string, 
    translation: THREE.Vector3, 
    unitsPerMeter: number = 1, 
    description?: string
  ): CoordinateSystem {
    const matrix = new THREE.Matrix4().makeTranslation(translation.x, translation.y, translation.z);
    return new CoordinateSystem(name, unitsPerMeter, matrix, description);
  }
  
  /**
   * Create a coordinate system with scale
   */
  static createWithScale(
    name: string, 
    scale: THREE.Vector3, 
    unitsPerMeter: number = 1, 
    description?: string
  ): CoordinateSystem {
    const matrix = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
    return new CoordinateSystem(name, unitsPerMeter, matrix, description);
  }
}

/**
 * Manages coordinate system transformations and provides caching for performance
 */
export class CoordinateManager {
  private readonly systems = new Map<string, CoordinateSystem>();
  private readonly transformCache = new Map<string, THREE.Matrix4>();
  
  /**
   * Register a coordinate system
   */
  registerSystem(system: CoordinateSystem): void {
    this.systems.set(system.name, system);
    this.clearTransformCache();
  }
  
  /**
   * Register a coordinate system by parameters
   */
  registerSystemByParams(
    name: string, 
    unitsPerMeter: number, 
    transformMatrix: THREE.Matrix4, 
    description?: string
  ): void {
    const system = new CoordinateSystem(name, unitsPerMeter, transformMatrix.clone(), description);
    this.registerSystem(system);
  }
  
  /**
   * Get a registered coordinate system
   */
  getSystem(name: string): CoordinateSystem {
    const system = this.systems.get(name);
    if (!system) {
      throw new Error(`Coordinate system not found: ${name}. Available: ${Array.from(this.systems.keys()).join(', ')}`);
    }
    return system;
  }
  
  /**
   * Check if a coordinate system is registered
   */
  hasSystem(name: string): boolean {
    return this.systems.has(name);
  }
  
  /**
   * Get all registered coordinate system names
   */
  getSystemNames(): string[] {
    return Array.from(this.systems.keys());
  }
  
  /**
   * Transform a single point between coordinate systems
   */
  transformPoint(point: THREE.Vector3, fromSystem: string, toSystem: string): THREE.Vector3 {
    if (fromSystem === toSystem) {
      return point.clone();
    }
    
    const transformMatrix = this.getTransformMatrix(fromSystem, toSystem);
    return point.clone().applyMatrix4(transformMatrix);
  }
  
  /**
   * Transform multiple points between coordinate systems (optimized for batch operations)
   */
  transformPoints(points: THREE.Vector3[], fromSystem: string, toSystem: string): THREE.Vector3[] {
    if (fromSystem === toSystem) {
      return points.map(p => p.clone());
    }
    
    const transformMatrix = this.getTransformMatrix(fromSystem, toSystem);
    return points.map(point => point.clone().applyMatrix4(transformMatrix));
  }
  
  /**
   * Transform a vector (direction) between coordinate systems
   * Vectors are not affected by translation, only rotation and scale
   */
  transformVector(vector: THREE.Vector3, fromSystem: string, toSystem: string): THREE.Vector3 {
    if (fromSystem === toSystem) {
      return vector.clone();
    }
    
    const transformMatrix = this.getTransformMatrix(fromSystem, toSystem);
    
    // Extract only rotation and scale (no translation) for vector transformation
    const vectorMatrix = transformMatrix.clone();
    vectorMatrix.setPosition(0, 0, 0);
    
    return vector.clone().applyMatrix4(vectorMatrix);
  }
  
  /**
   * Get the transformation matrix between two coordinate systems
   * Results are cached for performance
   */
  getTransformMatrix(fromSystem: string, toSystem: string): THREE.Matrix4 {
    if (fromSystem === toSystem) {
      return new THREE.Matrix4(); // Identity matrix
    }
    
    const cacheKey = `${fromSystem}->${toSystem}`;
    
    if (this.transformCache.has(cacheKey)) {
      return this.transformCache.get(cacheKey)!.clone();
    }
    
    const from = this.getSystem(fromSystem);
    const to = this.getSystem(toSystem);
    
    // Transform through world coordinates as intermediate
    // fromSystem -> world -> toSystem
    const fromToWorld = from.transformMatrix.clone();
    const worldToTo = to.transformMatrix.clone().invert();
    const transform = fromToWorld.multiply(worldToTo);
    
    // Account for unit differences
    if (from.unitsPerMeter !== to.unitsPerMeter) {
      const scale = from.unitsPerMeter / to.unitsPerMeter;
      const scaleMatrix = new THREE.Matrix4().makeScale(scale, scale, scale);
      transform.multiplyMatrices(scaleMatrix, transform);
    }
    
    this.transformCache.set(cacheKey, transform.clone());
    return transform;
  }
  
  /**
   * Convert units between coordinate systems
   */
  convertUnits(value: number, fromSystem: string, toSystem: string): number {
    const from = this.getSystem(fromSystem);
    const to = this.getSystem(toSystem);
    
    return (value * from.unitsPerMeter) / to.unitsPerMeter;
  }
  
  /**
   * Get the scale factor between two coordinate systems
   */
  getScaleFactor(fromSystem: string, toSystem: string): number {
    const from = this.getSystem(fromSystem);
    const to = this.getSystem(toSystem);
    
    return from.unitsPerMeter / to.unitsPerMeter;
  }
  
  /**
   * Clear the transformation cache (call when systems are modified)
   */
  private clearTransformCache(): void {
    this.transformCache.clear();
  }
  
  /**
   * Remove a coordinate system
   */
  unregisterSystem(name: string): boolean {
    this.clearTransformCache();
    return this.systems.delete(name);
  }
  
  /**
   * Clear all coordinate systems
   */
  clear(): void {
    this.systems.clear();
    this.clearTransformCache();
  }
  
  /**
   * Get debug information about registered systems
   */
  getDebugInfo(): Record<string, any> {
    const systems: Record<string, any> = {};
    
    for (const [name, system] of this.systems) {
      systems[name] = {
        unitsPerMeter: system.unitsPerMeter,
        description: system.description,
        transformMatrix: system.transformMatrix.elements
      };
    }
    
    return {
      registeredSystems: systems,
      cacheSize: this.transformCache.size
    };
  }
}

/**
 * Predefined coordinate systems for common use cases
 */
export class StandardCoordinateSystems {
  /**
   * Create standard coordinate systems used in CAM applications
   */
  static createStandardSystems(): CoordinateSystem[] {
    return [
      // World coordinate system (meters)
      CoordinateSystem.createIdentity('world', 1, 'World coordinates in meters'),
      
      // DXF coordinate system (typically millimeters)
      CoordinateSystem.createIdentity('dxf', 1000, 'DXF file coordinates (assumed mm)'),
      
      // Three.js world coordinates
      CoordinateSystem.createIdentity('three-world', 1, 'Three.js world coordinates'),
      
      // Screen coordinates (pixels at 96 DPI)
      CoordinateSystem.createIdentity('screen', 96 / 0.0254, 'Screen pixels at 96 DPI'),
      
      // Inches
      CoordinateSystem.createIdentity('inches', 39.3701, 'Imperial inches'),
      
      // Millimeters
      CoordinateSystem.createIdentity('millimeters', 1000, 'Metric millimeters')
    ];
  }
  
  /**
   * Setup a coordinate manager with standard systems
   */
  static setupStandardManager(): CoordinateManager {
    const manager = new CoordinateManager();
    
    for (const system of StandardCoordinateSystems.createStandardSystems()) {
      manager.registerSystem(system);
    }
    
    return manager;
  }
}