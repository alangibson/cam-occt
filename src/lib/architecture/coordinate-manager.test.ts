import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { 
  CoordinateSystem, 
  CoordinateManager, 
  StandardCoordinateSystems 
} from './coordinate-manager';

describe('CoordinateSystem', () => {
  it('should create coordinate system with basic properties', () => {
    const matrix = new THREE.Matrix4().makeTranslation(1, 2, 3);
    const system = new CoordinateSystem('test', 1000, matrix, 'Test system');
    
    expect(system.name).toBe('test');
    expect(system.unitsPerMeter).toBe(1000);
    expect(system.description).toBe('Test system');
    expect(system.transformMatrix.equals(matrix)).toBe(true);
  });
  
  it('should create coordinate system with new transform', () => {
    const originalMatrix = new THREE.Matrix4().makeTranslation(1, 2, 3);
    const newMatrix = new THREE.Matrix4().makeTranslation(4, 5, 6);
    const system = new CoordinateSystem('test', 1000, originalMatrix);
    
    const newSystem = system.withTransform(newMatrix);
    
    expect(newSystem.name).toBe('test');
    expect(newSystem.unitsPerMeter).toBe(1000);
    expect(newSystem.transformMatrix.equals(newMatrix)).toBe(true);
    expect(system.transformMatrix.equals(originalMatrix)).toBe(true); // Original unchanged
  });
  
  it('should create identity coordinate system', () => {
    const system = CoordinateSystem.createIdentity('identity', 500, 'Identity test');
    
    expect(system.name).toBe('identity');
    expect(system.unitsPerMeter).toBe(500);
    expect(system.description).toBe('Identity test');
    expect(system.transformMatrix.equals(new THREE.Matrix4())).toBe(true);
  });
  
  it('should create coordinate system with translation', () => {
    const translation = new THREE.Vector3(10, 20, 30);
    const system = CoordinateSystem.createWithTranslation('translated', translation, 100);
    
    expect(system.name).toBe('translated');
    expect(system.unitsPerMeter).toBe(100);
    
    const expectedMatrix = new THREE.Matrix4().makeTranslation(10, 20, 30);
    expect(system.transformMatrix.equals(expectedMatrix)).toBe(true);
  });
  
  it('should create coordinate system with scale', () => {
    const scale = new THREE.Vector3(2, 3, 4);
    const system = CoordinateSystem.createWithScale('scaled', scale, 200);
    
    expect(system.name).toBe('scaled');
    expect(system.unitsPerMeter).toBe(200);
    
    const expectedMatrix = new THREE.Matrix4().makeScale(2, 3, 4);
    expect(system.transformMatrix.equals(expectedMatrix)).toBe(true);
  });
});

describe('CoordinateManager', () => {
  let manager: CoordinateManager;
  let system1: CoordinateSystem;
  let system2: CoordinateSystem;
  
  beforeEach(() => {
    manager = new CoordinateManager();
    system1 = CoordinateSystem.createIdentity('system1', 1);
    system2 = CoordinateSystem.createWithTranslation('system2', new THREE.Vector3(10, 0, 0), 1000);
  });
  
  describe('System Registration', () => {
    it('should register and retrieve coordinate systems', () => {
      manager.registerSystem(system1);
      
      const retrieved = manager.getSystem('system1');
      expect(retrieved).toBe(system1);
    });
    
    it('should register system by parameters', () => {
      const matrix = new THREE.Matrix4().makeTranslation(5, 10, 15);
      manager.registerSystemByParams('test', 500, matrix, 'Test description');
      
      const system = manager.getSystem('test');
      expect(system.name).toBe('test');
      expect(system.unitsPerMeter).toBe(500);
      expect(system.description).toBe('Test description');
      expect(system.transformMatrix.equals(matrix)).toBe(true);
    });
    
    it('should check if system exists', () => {
      expect(manager.hasSystem('system1')).toBe(false);
      
      manager.registerSystem(system1);
      expect(manager.hasSystem('system1')).toBe(true);
    });
    
    it('should get system names', () => {
      manager.registerSystem(system1);
      manager.registerSystem(system2);
      
      const names = manager.getSystemNames();
      expect(names).toContain('system1');
      expect(names).toContain('system2');
      expect(names.length).toBe(2);
    });
    
    it('should throw error for non-existent system', () => {
      expect(() => manager.getSystem('nonexistent')).toThrow('Coordinate system not found: nonexistent');
    });
    
    it('should unregister systems', () => {
      manager.registerSystem(system1);
      expect(manager.hasSystem('system1')).toBe(true);
      
      const removed = manager.unregisterSystem('system1');
      expect(removed).toBe(true);
      expect(manager.hasSystem('system1')).toBe(false);
      
      const notRemoved = manager.unregisterSystem('nonexistent');
      expect(notRemoved).toBe(false);
    });
    
    it('should clear all systems', () => {
      manager.registerSystem(system1);
      manager.registerSystem(system2);
      expect(manager.getSystemNames().length).toBe(2);
      
      manager.clear();
      expect(manager.getSystemNames().length).toBe(0);
    });
  });
  
  describe('Point Transformations', () => {
    beforeEach(() => {
      manager.registerSystem(system1); // Identity at origin
      manager.registerSystem(system2); // Translated by (10, 0, 0)
    });
    
    it('should transform point between different systems', () => {
      const point = new THREE.Vector3(5, 5, 5);
      
      const transformed = manager.transformPoint(point, 'system1', 'system2');
      
      // Point should be offset by the system2 translation
      expect(transformed.x).toBeCloseTo(-5); // 5 - 10 = -5
      expect(transformed.y).toBeCloseTo(5);
      expect(transformed.z).toBeCloseTo(5);
      
      // Original point should be unchanged
      expect(point.x).toBe(5);
      expect(point.y).toBe(5);
      expect(point.z).toBe(5);
    });
    
    it('should return cloned point for same system transformation', () => {
      const point = new THREE.Vector3(1, 2, 3);
      
      const transformed = manager.transformPoint(point, 'system1', 'system1');
      
      expect(transformed.equals(point)).toBe(true);
      expect(transformed).not.toBe(point); // Should be a clone
    });
    
    it('should transform multiple points efficiently', () => {
      const points = [
        new THREE.Vector3(1, 2, 3),
        new THREE.Vector3(4, 5, 6),
        new THREE.Vector3(7, 8, 9)
      ];
      
      const transformed = manager.transformPoints(points, 'system1', 'system2');
      
      expect(transformed.length).toBe(3);
      expect(transformed[0].x).toBeCloseTo(-9); // 1 - 10 = -9
      expect(transformed[1].x).toBeCloseTo(-6); // 4 - 10 = -6
      expect(transformed[2].x).toBeCloseTo(-3); // 7 - 10 = -3
      
      // Y and Z should be unchanged
      expect(transformed[0].y).toBeCloseTo(2);
      expect(transformed[0].z).toBeCloseTo(3);
    });
  });
  
  describe('Vector Transformations', () => {
    beforeEach(() => {
      manager.registerSystem(system1);
      
      // Create system with rotation
      const rotationMatrix = new THREE.Matrix4().makeRotationZ(Math.PI / 2); // 90 degrees around Z
      const system3 = new CoordinateSystem('rotated', 1, rotationMatrix);
      manager.registerSystem(system3);
    });
    
    it('should transform vectors without translation effects', () => {
      const vector = new THREE.Vector3(1, 0, 0);
      
      const transformed = manager.transformVector(vector, 'system1', 'rotated');
      
      // Vector should be rotated 90 degrees, becoming (0, 1, 0)
      expect(transformed.x).toBeCloseTo(0, 5);
      expect(transformed.y).toBeCloseTo(1, 5);
      expect(transformed.z).toBeCloseTo(0, 5);
    });
  });
  
  describe('Transform Matrix Caching', () => {
    beforeEach(() => {
      manager.registerSystem(system1);
      manager.registerSystem(system2);
    });
    
    it('should cache transform matrices for performance', () => {
      const matrix1 = manager.getTransformMatrix('system1', 'system2');
      const matrix2 = manager.getTransformMatrix('system1', 'system2');
      
      // Should be equal but different instances (cached)
      expect(matrix1.equals(matrix2)).toBe(true);
    });
    
    it('should return identity matrix for same system', () => {
      const matrix = manager.getTransformMatrix('system1', 'system1');
      expect(matrix.equals(new THREE.Matrix4())).toBe(true);
    });
  });
  
  describe('Unit Conversions', () => {
    beforeEach(() => {
      const meterSystem = CoordinateSystem.createIdentity('meters', 1);
      const mmSystem = CoordinateSystem.createIdentity('millimeters', 1000);
      const inchSystem = CoordinateSystem.createIdentity('inches', 39.3701);
      
      manager.registerSystem(meterSystem);
      manager.registerSystem(mmSystem);
      manager.registerSystem(inchSystem);
    });
    
    it('should convert units between coordinate systems', () => {
      // 1 meter = 1000 millimeters
      const mmValue = manager.convertUnits(1, 'meters', 'millimeters');
      expect(mmValue).toBeCloseTo(1000);
      
      // 1000 millimeters = 1 meter
      const mValue = manager.convertUnits(1000, 'millimeters', 'meters');
      expect(mValue).toBeCloseTo(1);
      
      // 1 inch ≈ 25.4 mm
      const mmFromInch = manager.convertUnits(1, 'inches', 'millimeters');
      expect(mmFromInch).toBeCloseTo(25.4, 1);
    });
    
    it('should get scale factor between systems', () => {
      const scale = manager.getScaleFactor('meters', 'millimeters');
      expect(scale).toBeCloseTo(0.001); // 1/1000
      
      const inverseScale = manager.getScaleFactor('millimeters', 'meters');
      expect(inverseScale).toBeCloseTo(1000);
    });
  });
  
  describe('Debug Information', () => {
    it('should provide debug information', () => {
      manager.registerSystem(system1);
      manager.registerSystem(system2);
      
      const debugInfo = manager.getDebugInfo();
      
      expect(debugInfo.registeredSystems).toHaveProperty('system1');
      expect(debugInfo.registeredSystems).toHaveProperty('system2');
      expect(debugInfo.cacheSize).toBe(0); // No transforms cached yet
      
      // Cache a transform
      manager.getTransformMatrix('system1', 'system2');
      
      const updatedDebugInfo = manager.getDebugInfo();
      expect(updatedDebugInfo.cacheSize).toBe(1);
    });
  });
});

describe('StandardCoordinateSystems', () => {
  it('should create standard coordinate systems', () => {
    const systems = StandardCoordinateSystems.createStandardSystems();
    
    expect(systems.length).toBeGreaterThan(0);
    
    const systemNames = systems.map(s => s.name);
    expect(systemNames).toContain('world');
    expect(systemNames).toContain('dxf');
    expect(systemNames).toContain('three-world');
    expect(systemNames).toContain('screen');
    expect(systemNames).toContain('inches');
    expect(systemNames).toContain('millimeters');
  });
  
  it('should setup standard manager with all systems', () => {
    const manager = StandardCoordinateSystems.setupStandardManager();
    
    expect(manager.hasSystem('world')).toBe(true);
    expect(manager.hasSystem('dxf')).toBe(true);
    expect(manager.hasSystem('three-world')).toBe(true);
    expect(manager.hasSystem('screen')).toBe(true);
    expect(manager.hasSystem('inches')).toBe(true);
    expect(manager.hasSystem('millimeters')).toBe(true);
  });
  
  it('should have correct unit conversions for standard systems', () => {
    const manager = StandardCoordinateSystems.setupStandardManager();
    
    // 1 inch should equal about 25.4 mm
    const mmPerInch = manager.convertUnits(1, 'inches', 'millimeters');
    expect(mmPerInch).toBeCloseTo(25.4, 1);
    
    // DXF (mm) to world (m) conversion
    const metersFromMm = manager.convertUnits(1000, 'dxf', 'world');
    expect(metersFromMm).toBeCloseTo(1);
  });
});