import * as THREE from 'three';

export interface SelectableObject extends THREE.Object3D {
  userData: {
    shapeIndex: number;
    [key: string]: any;
  };
}

export interface SelectionEvent {
  object: SelectableObject;
  intersection: THREE.Intersection;
  shapeInfo?: any;
}

export interface SelectionCallbacks {
  onShapeSelect?: (event: SelectionEvent | null) => void;
  onShapeHover?: (shapeInfo: any) => void;
  onCalculateShapeInfo?: (object: SelectableObject, intersection: THREE.Intersection) => any;
  onHighlightObject?: (object: SelectableObject, highlighted: boolean, type: 'hover' | 'selection') => void;
  onAddPointMarkers?: (shapeInfo: any) => void;
  onClearPointMarkers?: () => void;
}

/**
 * Manages selection state and behavior for interactive 3D objects.
 * Implements hover-based selection with click-to-pin functionality.
 */
export class SelectionManager {
  private hoveredObject: SelectableObject | null = null;
  private selectedObject: SelectableObject | null = null;
  private pinnedObject: SelectableObject | null = null;
  
  private callbacks: SelectionCallbacks;

  constructor(callbacks: SelectionCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Handle hover over an object
   */
  handleHover(object: SelectableObject, intersection: THREE.Intersection): void {
    if (this.hoveredObject === object) {
      return; // Already hovering over this object
    }

    // Clear previous hover
    this.clearHover();

    // Set new hover
    this.hoveredObject = object;

    // Apply hover highlighting
    this.callbacks.onHighlightObject?.(object, true, 'hover');

    // Calculate shape info for hover
    const shapeInfo = this.callbacks.onCalculateShapeInfo?.(object, intersection);

    // Call hover callback (not selection callback)
    this.callbacks.onShapeHover?.(shapeInfo);

    // Only select if something is pinned and it's the same shape
    if (this.pinnedObject && this.isSameShape(this.pinnedObject, object)) {
      this.selectShape(object, intersection);
    }
  }

  /**
   * Handle hover end (mouse left all objects)
   */
  handleHoverEnd(): void {
    this.clearHover();
    // Clear hover callback
    console.log('📤 Clearing onShapeHover callback');
    this.callbacks.onShapeHover?.(null);
  }

  /**
   * Handle click on an object (pins the selection)
   */
  handleClick(object: SelectableObject, intersection: THREE.Intersection): void {
    // If clicking a different shape, unpin the previous one
    if (this.pinnedObject && !this.isSameShape(this.pinnedObject, object)) {
      this.unpinShape();
    }

    // Pin this shape
    this.pinnedObject = object;

    // Ensure it's selected
    this.selectShape(object, intersection);
  }

  /**
   * Handle click on empty space (unpins selection)
   */
  handleClickEmpty(): void {
    this.unpinShape();
  }

  /**
   * Get current selection state
   */
  getSelectionState() {
    return {
      hoveredObject: this.hoveredObject,
      selectedObject: this.selectedObject,
      pinnedObject: this.pinnedObject,
      hasHoveredObject: !!this.hoveredObject,
      hasSelectedObject: !!this.selectedObject,
      hasPinnedObject: !!this.pinnedObject,
      hoveredShapeIndex: this.hoveredObject?.userData?.shapeIndex,
      selectedShapeIndex: this.selectedObject?.userData?.shapeIndex,
      pinnedShapeIndex: this.pinnedObject?.userData?.shapeIndex
    };
  }

  /**
   * Clear all selection state
   */
  clearAll(): void {
    this.clearHover();
    this.unpinShape();
  }

  /**
   * Update callbacks
   */
  setCallbacks(callbacks: SelectionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Private methods

  private selectShape(object: SelectableObject, intersection: THREE.Intersection): void {
    console.log('📌 SelectionManager.selectShape called with:', object.userData);
    
    if (this.selectedObject === object) {
      return; // Already selected
    }

    // Unselect previous
    if (this.selectedObject) {
      this.callbacks.onHighlightObject?.(this.selectedObject, false, 'selection');
    }

    // Select new object
    this.selectedObject = object;
    this.callbacks.onHighlightObject?.(object, true, 'selection');

    // Calculate shape info
    const shapeInfo = this.callbacks.onCalculateShapeInfo?.(object, intersection);
    console.log('📊 Calculated shape info:', shapeInfo);

    // Add point markers
    if (shapeInfo) {
      this.callbacks.onAddPointMarkers?.(shapeInfo);
    }

    // Notify listeners
    console.log('📤 Calling onShapeSelect callback with event:', { object, intersection, shapeInfo });
    this.callbacks.onShapeSelect?.({
      object,
      intersection,
      shapeInfo
    });
  }

  private unselectShape(): void {
    if (!this.selectedObject) {
      return;
    }

    // Clear highlighting
    this.callbacks.onHighlightObject?.(this.selectedObject, false, 'selection');

    // Clear state
    this.selectedObject = null;

    // Clear point markers
    this.callbacks.onClearPointMarkers?.();

    // Notify listeners
    this.callbacks.onShapeSelect?.(null);
  }

  private clearHover(): void {
    if (!this.hoveredObject) {
      return;
    }

    // Clear hover highlighting
    this.callbacks.onHighlightObject?.(this.hoveredObject, false, 'hover');

    // Clear hover state
    this.hoveredObject = null;

    // If no object is pinned, unselect when hover ends
    if (!this.pinnedObject) {
      this.unselectShape();
    }
  }

  private unpinShape(): void {
    this.pinnedObject = null;

    // If not hovering over anything, unselect
    if (!this.hoveredObject) {
      this.unselectShape();
    }
  }

  private isSameShape(obj1: SelectableObject, obj2: SelectableObject): boolean {
    return obj1.userData.shapeIndex === obj2.userData.shapeIndex;
  }
}