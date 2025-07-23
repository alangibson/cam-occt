/**
 * Presentation layer - UI components and view models
 * Handles user interactions and presents data from application layer
 */

import { 
  GeometryApplicationService, 
  VisualizationApplicationService,
  GeometryApplicationResult,
  VisualizationApplicationResult,
  ViewState,
  ViewTransform,
  ExportFormat 
} from './application';

import { GeometryModel, ShapeOperation, OperationType } from './domain';
import { EventBus } from '../event-bus';

/**
 * View models for UI components
 */
export interface GeometryViewModel {
  id: string;
  fileName: string;
  fileType: string;
  units: string;
  shapeCount: number;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];
  lastModified: string;
}

export interface ShapeViewModel {
  id: string;
  type: string;
  layer: string;
  color?: string;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  properties: ShapePropertyViewModel[];
}

export interface ShapePropertyViewModel {
  name: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
  editable: boolean;
  unit?: string;
}

export interface ViewerViewModel {
  geometries: ShapeViewModel[];
  selectedShapeId: string | null;
  hoveredShapeId: string | null;
  zoomLevel: number;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  bounds: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  isLoading: boolean;
  error: string | null;
}

export interface ApplicationViewModel {
  currentStage: 'idle' | 'loading' | 'loaded' | 'modifying' | 'programming' | 'exporting' | 'error';
  loadedGeometry: GeometryViewModel | null;
  viewer: ViewerViewModel;
  canModify: boolean;
  canExport: boolean;
  isProcessing: boolean;
  statusMessage: string;
  errors: string[];
  warnings: string[];
}

/**
 * Presentation services for view model creation
 */
export class GeometryViewModelService {
  createGeometryViewModel(geometry: GeometryModel): GeometryViewModel {
    const bounds = geometry.metadata.boundingBox;
    
    return {
      id: geometry.id,
      fileName: geometry.metadata.fileName,
      fileType: geometry.metadata.fileType,
      units: geometry.metadata.units,
      shapeCount: geometry.shapes.length,
      boundingBox: {
        width: bounds.max.x - bounds.min.x,
        height: bounds.max.y - bounds.min.y,
        depth: bounds.max.z - bounds.min.z
      },
      isValid: true, // Would be calculated from validation
      validationErrors: [],
      validationWarnings: [],
      lastModified: geometry.metadata.modifiedAt.toISOString()
    };
  }
  
  createShapeViewModels(geometry: GeometryModel, selectedId?: string, hoveredId?: string): ShapeViewModel[] {
    return geometry.shapes.map(shape => ({
      id: shape.id,
      type: shape.type,
      layer: shape.properties.layer,
      color: shape.properties.color,
      visible: shape.properties.visible,
      selected: shape.id === selectedId,
      hovered: shape.id === hoveredId,
      properties: this.createShapeProperties(shape)
    }));
  }
  
  private createShapeProperties(shape: any): ShapePropertyViewModel[] {
    const properties: ShapePropertyViewModel[] = [
      {
        name: 'Type',
        value: shape.type,
        type: 'string',
        editable: false
      },
      {
        name: 'Layer',
        value: shape.properties.layer,
        type: 'string',
        editable: true
      },
      {
        name: 'Visible',
        value: shape.properties.visible.toString(),
        type: 'boolean',
        editable: true
      }
    ];
    
    if (shape.properties.color) {
      properties.push({
        name: 'Color',
        value: shape.properties.color,
        type: 'string',
        editable: true
      });
    }
    
    // Add type-specific properties
    if (shape.type === 'circle' && shape.edges[0]?.parameters?.radius) {
      properties.push({
        name: 'Radius',
        value: shape.edges[0].parameters.radius.toString(),
        type: 'number',
        editable: true,
        unit: 'mm'
      });
    }
    
    return properties;
  }
}

/**
 * UI event handlers and controllers
 */
export class GeometryController {
  constructor(
    private geometryService: GeometryApplicationService,
    private visualizationService: VisualizationApplicationService,
    private viewModelService: GeometryViewModelService,
    private eventBus: EventBus
  ) {
    this.setupEventHandlers();
  }
  
  async loadGeometry(file: File): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.geometryService.loadGeometry(file);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to load geometry'
        };
      }
      
      // Notify UI of successful load
      await this.eventBus.emit({
        type: 'ui.geometry.loaded',
        data: {
          geometry: result.data,
          viewModel: this.viewModelService.createGeometryViewModel(result.data!)
        }
      });
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  async selectShape(geometryId: string, shapeId: string | null): Promise<void> {
    try {
      await this.visualizationService.updateSelection(geometryId, shapeId);
      
      await this.eventBus.emit({
        type: 'ui.shape.selected',
        data: { geometryId, shapeId }
      });
      
    } catch (error) {
      console.error('Failed to select shape:', error);
      
      await this.eventBus.emit({
        type: 'ui.error',
        data: { message: 'Failed to select shape' }
      });
    }
  }
  
  async modifyShape(
    geometryId: string, 
    shapeId: string, 
    operation: ShapeOperation
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.geometryService.modifyShape(geometryId, shapeId, operation);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to modify shape'
        };
      }
      
      // Notify UI of successful modification
      await this.eventBus.emit({
        type: 'ui.shape.modified',
        data: {
          geometry: result.data,
          viewModel: this.viewModelService.createGeometryViewModel(result.data!)
        }
      });
      
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  async exportGeometry(geometryId: string, format: ExportFormat): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const result = await this.geometryService.exportGeometry(geometryId, format);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to export geometry'
        };
      }
      
      return {
        success: true,
        data: result.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  
  async transformView(transform: ViewTransform): Promise<void> {
    try {
      await this.visualizationService.transformView(transform);
      
      const viewState = await this.visualizationService.getViewState();
      if (viewState.success && viewState.data) {
        await this.eventBus.emit({
          type: 'ui.view.transformed',
          data: { viewState: viewState.data }
        });
      }
      
    } catch (error) {
      console.error('Failed to transform view:', error);
    }
  }
  
  private setupEventHandlers(): void {
    this.eventBus.subscribe('geometry.loaded', this.handleGeometryLoaded.bind(this));
    this.eventBus.subscribe('shape.modified', this.handleShapeModified.bind(this));
  }
  
  private async handleGeometryLoaded(event: any): Promise<void> {
    // Update UI state when geometry is loaded at domain level
    const geometry = event.data.geometry as GeometryModel;
    const viewModel = this.viewModelService.createGeometryViewModel(geometry);
    
    await this.eventBus.emit({
      type: 'ui.state.updated',
      data: {
        currentStage: 'loaded',
        geometry: viewModel
      }
    });
  }
  
  private async handleShapeModified(event: any): Promise<void> {
    // Update UI state when shape is modified at domain level
    const geometry = event.data.geometry as GeometryModel;
    const viewModel = this.viewModelService.createGeometryViewModel(geometry);
    
    await this.eventBus.emit({
      type: 'ui.state.updated',
      data: {
        geometry: viewModel
      }
    });
  }
}

/**
 * UI component interfaces (for framework integration)
 */
export interface UIComponent<TProps = any, TState = any> {
  props: TProps;
  state: TState;
  render(): any;
  setState(state: Partial<TState>): void;
}

export interface GeometryViewerProps {
  geometries: ShapeViewModel[];
  selectedShapeId: string | null;
  hoveredShapeId: string | null;
  zoomLevel: number;
  onShapeSelect: (shapeId: string | null) => void;
  onShapeHover: (shapeId: string | null) => void;
  onViewTransform: (transform: ViewTransform) => void;
}

export interface PropertiesPanelProps {
  selectedShape: ShapeViewModel | null;
  onPropertyChange: (shapeId: string, propertyName: string, value: any) => void;
}

export interface FileUploadProps {
  acceptedTypes: string[];
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

/**
 * Form validation helpers
 */
export class FormValidator {
  static validateFile(file: File): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (file.size === 0) {
      errors.push('File is empty');
    }
    
    if (file.size > 100 * 1024 * 1024) { // 100MB
      errors.push('File is too large (max 100MB)');
    }
    
    const allowedExtensions = ['.dxf', '.svg'];
    const hasValidExtension = allowedExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      errors.push('File type not supported. Use .dxf or .svg files');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  static validateShapeProperty(
    propertyName: string, 
    value: any, 
    type: 'string' | 'number' | 'boolean'
  ): { valid: boolean; error?: string } {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Value must be a string' };
        }
        if (value.trim().length === 0) {
          return { valid: false, error: 'Value cannot be empty' };
        }
        break;
        
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          return { valid: false, error: 'Value must be a number' };
        }
        if (propertyName.toLowerCase().includes('radius') && num <= 0) {
          return { valid: false, error: 'Radius must be positive' };
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return { valid: false, error: 'Value must be true or false' };
        }
        break;
    }
    
    return { valid: true };
  }
}

/**
 * UI state management helpers
 */
export class UIStateManager {
  private state: ApplicationViewModel = {
    currentStage: 'idle',
    loadedGeometry: null,
    viewer: {
      geometries: [],
      selectedShapeId: null,
      hoveredShapeId: null,
      zoomLevel: 100,
      cameraPosition: { x: 0, y: 0, z: 10 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 }
      },
      isLoading: false,
      error: null
    },
    canModify: false,
    canExport: false,
    isProcessing: false,
    statusMessage: 'Ready',
    errors: [],
    warnings: []
  };
  
  private listeners = new Set<(state: ApplicationViewModel) => void>();
  
  getState(): ApplicationViewModel {
    return { ...this.state };
  }
  
  setState(update: Partial<ApplicationViewModel>): void {
    this.state = { ...this.state, ...update };
    this.notifyListeners();
  }
  
  updateViewerState(update: Partial<ViewerViewModel>): void {
    this.state.viewer = { ...this.state.viewer, ...update };
    this.notifyListeners();
  }
  
  subscribe(listener: (state: ApplicationViewModel) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in UI state listener:', error);
      }
    }
  }
}

/**
 * Helper functions for UI operations
 */
export class UIHelpers {
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  static formatCoordinate(value: number, units: string): string {
    return `${value.toFixed(2)} ${units}`;
  }
  
  static createShapeOperationFromUI(
    operationType: string, 
    parameters: any
  ): ShapeOperation | null {
    try {
      const type = operationType.toUpperCase() as keyof typeof OperationType;
      
      if (!OperationType[type]) {
        return null;
      }
      
      return {
        type: OperationType[type],
        parameters
      };
    } catch (error) {
      return null;
    }
  }
  
  static getStageDisplayName(stage: string): string {
    const stageNames: Record<string, string> = {
      idle: 'Ready',
      loading: 'Loading File...',
      loaded: 'File Loaded',
      modifying: 'Modifying Geometry',
      programming: 'Generating Toolpaths',
      exporting: 'Exporting G-Code',
      error: 'Error Occurred'
    };
    
    return stageNames[stage] || stage;
  }
  
  static shouldShowModifyUI(stage: string): boolean {
    return ['loaded', 'modifying'].includes(stage);
  }
  
  static shouldShowProgramUI(stage: string): boolean {
    return ['loaded', 'programming', 'exporting'].includes(stage);
  }
}