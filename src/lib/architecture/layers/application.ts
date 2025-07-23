/**
 * Application layer - Use cases and application services
 * Orchestrates domain operations and coordinates with infrastructure
 */

import { 
  GeometryModel, 
  GeometryOperations, 
  ShapeOperation, 
  ValidationResult,
  DomainEvent,
  GeometryCreatedEvent,
  ShapeModifiedEvent,
  ValidGeometrySpecification,
  HasShapesSpecification
} from './domain';

import { EventBus } from '../event-bus';
import { Command, TransactionManager } from '../command';
import { CoordinateManager } from '../coordinate-manager';

/**
 * Application service interfaces
 */
export interface GeometryApplicationService {
  loadGeometry(file: File): Promise<GeometryApplicationResult<GeometryModel>>;
  modifyShape(geometryId: string, shapeId: string, operation: ShapeOperation): Promise<GeometryApplicationResult<GeometryModel>>;
  getGeometry(geometryId: string): Promise<GeometryApplicationResult<GeometryModel>>;
  validateGeometry(geometryId: string): Promise<GeometryApplicationResult<ValidationResult>>;
  exportGeometry(geometryId: string, format: ExportFormat): Promise<GeometryApplicationResult<string>>;
}

export interface VisualizationApplicationService {
  renderGeometry(geometry: GeometryModel): Promise<VisualizationApplicationResult<RenderResult>>;
  updateSelection(geometryId: string, shapeId: string | null): Promise<VisualizationApplicationResult<void>>;
  transformView(transform: ViewTransform): Promise<VisualizationApplicationResult<void>>;
  getViewState(): Promise<VisualizationApplicationResult<ViewState>>;
}

/**
 * Application DTOs and result types
 */
export interface GeometryApplicationResult<T> {
  success: boolean;
  data?: T;
  error?: ApplicationError;
  warnings?: string[];
}

export interface VisualizationApplicationResult<T> {
  success: boolean;
  data?: T;
  error?: ApplicationError;
}

export interface ApplicationError {
  code: string;
  message: string;
  details?: any;
}

export interface RenderResult {
  geometries: any[]; // Three.js geometries
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  renderTime: number;
}

export interface ViewTransform {
  type: 'zoom' | 'pan' | 'rotate';
  parameters: {
    zoom?: number;
    position?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
  };
}

export interface ViewState {
  camera: {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    zoom: number;
  };
  selection: {
    geometryId: string | null;
    shapeId: string | null;
  };
}

export enum ExportFormat {
  GCODE = 'gcode',
  DXF = 'dxf',
  SVG = 'svg'
}

/**
 * Application commands
 */
export class LoadGeometryCommand implements Command {
  constructor(
    private file: File,
    private geometryService: GeometryApplicationService,
    private eventBus: EventBus,
    private repository: GeometryRepository
  ) {}
  
  async execute(): Promise<void> {
    const result = await this.geometryService.loadGeometry(this.file);
    
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Failed to load geometry');
    }
    
    // Store geometry
    await this.repository.save(result.data);
    
    // Publish domain event
    await this.eventBus.emit({
      type: 'geometry.loaded',
      data: { geometry: result.data }
    });
  }
  
  async undo(): Promise<void> {
    // Remove geometry from repository
    // This would need the geometry ID from execute
    // In a real implementation, we'd store the ID
  }
  
  canExecute(): boolean {
    return this.file.size > 0 && (this.file.name.endsWith('.dxf') || this.file.name.endsWith('.svg'));
  }
  
  getDescription(): string {
    return `Load geometry from file: ${this.file.name}`;
  }
}

export class ModifyShapeCommand implements Command {
  private originalGeometry?: GeometryModel;
  
  constructor(
    private geometryId: string,
    private shapeId: string,
    private operation: ShapeOperation,
    private geometryService: GeometryApplicationService,
    private repository: GeometryRepository,
    private eventBus: EventBus
  ) {}
  
  async execute(): Promise<void> {
    // Get current geometry
    const currentResult = await this.geometryService.getGeometry(this.geometryId);
    if (!currentResult.success || !currentResult.data) {
      throw new Error('Geometry not found');
    }
    
    this.originalGeometry = currentResult.data;
    
    // Modify shape
    const modifyResult = await this.geometryService.modifyShape(
      this.geometryId,
      this.shapeId,
      this.operation
    );
    
    if (!modifyResult.success || !modifyResult.data) {
      throw new Error(modifyResult.error?.message || 'Failed to modify shape');
    }
    
    // Save modified geometry
    await this.repository.save(modifyResult.data);
    
    // Publish domain event
    await this.eventBus.emit({
      type: 'shape.modified',
      data: {
        geometryId: this.geometryId,
        shapeId: this.shapeId,
        operation: this.operation,
        geometry: modifyResult.data
      }
    });
  }
  
  async undo(): Promise<void> {
    if (this.originalGeometry) {
      await this.repository.save(this.originalGeometry);
      
      await this.eventBus.emit({
        type: 'shape.modification.undone',
        data: {
          geometryId: this.geometryId,
          shapeId: this.shapeId,
          geometry: this.originalGeometry
        }
      });
    }
  }
  
  canExecute(): boolean {
    return !!this.geometryId && !!this.shapeId && !!this.operation;
  }
  
  getDescription(): string {
    return `Modify shape ${this.shapeId} with ${this.operation.type} operation`;
  }
}

/**
 * Repository interfaces
 */
export interface GeometryRepository {
  save(geometry: GeometryModel): Promise<void>;
  findById(id: string): Promise<GeometryModel | null>;
  findAll(): Promise<GeometryModel[]>;
  delete(id: string): Promise<void>;
}

export interface ViewStateRepository {
  saveViewState(state: ViewState): Promise<void>;
  getViewState(): Promise<ViewState | null>;
}

/**
 * Application services implementation
 */
export class GeometryApplicationServiceImpl implements GeometryApplicationService {
  constructor(
    private domainService: GeometryOperations,
    private repository: GeometryRepository,
    private eventBus: EventBus,
    private coordinateManager: CoordinateManager,
    private transactionManager: TransactionManager
  ) {}
  
  async loadGeometry(file: File): Promise<GeometryApplicationResult<GeometryModel>> {
    try {
      // Parse file
      const fileData = await this.parseFile(file);
      
      // Create geometry model
      const geometry = this.domainService.createGeometry(fileData, {
        fileName: file.name,
        fileType: this.getFileType(file.name)
      });
      
      // Validate geometry
      const validation = this.domainService.validateGeometry(geometry);
      const warnings = validation.warnings.map(w => w.message);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Geometry validation failed',
            details: validation.errors
          }
        };
      }
      
      // Check business rules
      const validSpec = new ValidGeometrySpecification();
      const hasShapesSpec = new HasShapesSpecification();
      const businessRule = validSpec.and(hasShapesSpec);
      
      if (!businessRule.isSatisfiedBy(geometry)) {
        return {
          success: false,
          error: {
            code: 'BUSINESS_RULE_VIOLATION',
            message: 'Geometry does not meet business requirements'
          }
        };
      }
      
      // Save geometry
      await this.repository.save(geometry);
      
      // Publish domain event
      const event = new GeometryCreatedEvent(geometry);
      await this.publishDomainEvent(event);
      
      return {
        success: true,
        data: geometry,
        warnings
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LOAD_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
  
  async modifyShape(
    geometryId: string, 
    shapeId: string, 
    operation: ShapeOperation
  ): Promise<GeometryApplicationResult<GeometryModel>> {
    try {
      // Get current geometry
      const geometry = await this.repository.findById(geometryId);
      if (!geometry) {
        return {
          success: false,
          error: {
            code: 'GEOMETRY_NOT_FOUND',
            message: `Geometry with id ${geometryId} not found`
          }
        };
      }
      
      // Modify shape
      const modifiedGeometry = this.domainService.modifyShape(geometry, shapeId, operation);
      
      // Validate modified geometry
      const validation = this.domainService.validateGeometry(modifiedGeometry);
      if (!validation.isValid) {
        return {
          success: false,
          error: {
            code: 'MODIFICATION_INVALID',
            message: 'Shape modification resulted in invalid geometry',
            details: validation.errors
          }
        };
      }
      
      // Save modified geometry
      await this.repository.save(modifiedGeometry);
      
      // Publish domain event
      const event = new ShapeModifiedEvent(
        geometryId,
        shapeId,
        operation,
        geometry.version,
        modifiedGeometry.version
      );
      await this.publishDomainEvent(event);
      
      return {
        success: true,
        data: modifiedGeometry,
        warnings: validation.warnings.map(w => w.message)
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MODIFICATION_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
  
  async getGeometry(geometryId: string): Promise<GeometryApplicationResult<GeometryModel>> {
    try {
      const geometry = await this.repository.findById(geometryId);
      
      if (!geometry) {
        return {
          success: false,
          error: {
            code: 'GEOMETRY_NOT_FOUND',
            message: `Geometry with id ${geometryId} not found`
          }
        };
      }
      
      return {
        success: true,
        data: geometry
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
  
  async validateGeometry(geometryId: string): Promise<GeometryApplicationResult<ValidationResult>> {
    try {
      const geometry = await this.repository.findById(geometryId);
      
      if (!geometry) {
        return {
          success: false,
          error: {
            code: 'GEOMETRY_NOT_FOUND',
            message: `Geometry with id ${geometryId} not found`
          }
        };
      }
      
      const validation = this.domainService.validateGeometry(geometry);
      
      return {
        success: true,
        data: validation
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
  
  async exportGeometry(geometryId: string, format: ExportFormat): Promise<GeometryApplicationResult<string>> {
    try {
      const geometry = await this.repository.findById(geometryId);
      
      if (!geometry) {
        return {
          success: false,
          error: {
            code: 'GEOMETRY_NOT_FOUND',
            message: `Geometry with id ${geometryId} not found`
          }
        };
      }
      
      // Export geometry (would integrate with actual export services)
      const exportedData = await this.exportGeometryData(geometry, format);
      
      return {
        success: true,
        data: exportedData
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
  
  private async parseFile(file: File): Promise<any> {
    // This would integrate with actual file parsing services
    return {};
  }
  
  private getFileType(fileName: string): 'dxf' | 'svg' {
    return fileName.toLowerCase().endsWith('.dxf') ? 'dxf' : 'svg';
  }
  
  private async publishDomainEvent(event: DomainEvent): Promise<void> {
    await this.eventBus.emit({
      type: event.eventType,
      data: event
    });
  }
  
  private async exportGeometryData(geometry: GeometryModel, format: ExportFormat): Promise<string> {
    // This would integrate with actual export services
    switch (format) {
      case ExportFormat.GCODE:
        return ''; // G-code content
      case ExportFormat.DXF:
        return ''; // DXF content
      case ExportFormat.SVG:
        return ''; // SVG content
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

/**
 * Use case classes for complex operations
 */
export class LoadAndValidateGeometryUseCase {
  constructor(
    private geometryService: GeometryApplicationService,
    private transactionManager: TransactionManager
  ) {}
  
  async execute(file: File): Promise<GeometryApplicationResult<GeometryModel>> {
    const loadCommand = new LoadGeometryCommand(
      file,
      this.geometryService,
      new EventBus(), // Would be injected
      {} as GeometryRepository // Would be injected
    );
    
    try {
      await this.transactionManager.executeCommand(loadCommand);
      return await this.geometryService.getGeometry(''); // Would need the ID from command
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'USE_CASE_FAILED',
          message: (error as Error).message,
          details: error
        }
      };
    }
  }
}

/**
 * Application event handlers
 */
export class GeometryEventHandlers {
  constructor(
    private visualizationService: VisualizationApplicationService,
    private eventBus: EventBus
  ) {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.eventBus.subscribe('geometry.loaded', this.handleGeometryLoaded.bind(this));
    this.eventBus.subscribe('shape.modified', this.handleShapeModified.bind(this));
  }
  
  private async handleGeometryLoaded(event: any): Promise<void> {
    try {
      const geometry = event.data.geometry as GeometryModel;
      await this.visualizationService.renderGeometry(geometry);
    } catch (error) {
      console.error('Failed to handle geometry loaded event:', error);
    }
  }
  
  private async handleShapeModified(event: any): Promise<void> {
    try {
      const { geometry } = event.data;
      await this.visualizationService.renderGeometry(geometry);
    } catch (error) {
      console.error('Failed to handle shape modified event:', error);
    }
  }
}