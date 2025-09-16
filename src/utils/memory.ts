export interface MemoryOptimization {
  proseMirrorCleanup: () => void;
  eventListenerCleanup: () => void;
  contextStateOptimization: boolean;
  componentLazyLoading: boolean;
}

export interface CleanupFunction {
  (): void;
}

export class MemoryManager {
  private cleanupFunctions: Set<CleanupFunction> = new Set();
  private proseMirrorInstances: WeakMap<object, CleanupFunction> = new WeakMap();
  private eventListeners: Array<{ element: EventTarget; event: string; handler: EventListener }> = [];

  // Register cleanup function
  registerCleanup(fn: CleanupFunction): void {
    this.cleanupFunctions.add(fn);
  }

  // Unregister cleanup function
  unregisterCleanup(fn: CleanupFunction): void {
    this.cleanupFunctions.delete(fn);
  }

  // Register ProseMirror instance for cleanup
  registerProseMirrorInstance(instance: object, cleanup: CleanupFunction): void {
    this.proseMirrorInstances.set(instance, cleanup);
  }

  // Clean up specific ProseMirror instance
  cleanupProseMirrorInstance(instance: object): void {
    const cleanup = this.proseMirrorInstances.get(instance);
    if (cleanup) {
      cleanup();
      this.proseMirrorInstances.delete(instance);
    }
  }

  // Add event listener with automatic cleanup tracking
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.eventListeners.push({ element, event, handler });
  }

  // Remove specific event listener
  removeEventListener(element: EventTarget, event: string, handler: EventListener): void {
    element.removeEventListener(event, handler);
    const index = this.eventListeners.findIndex(
      (listener) => 
        listener.element === element && 
        listener.event === event && 
        listener.handler === handler
    );
    if (index >= 0) {
      this.eventListeners.splice(index, 1);
    }
  }

  // Clean up all event listeners
  cleanupEventListeners(): void {
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        console.warn('Error removing event listener:', error);
      }
    });
    this.eventListeners = [];
  }

  // Execute all cleanup functions
  cleanup(): void {
    console.log('🧹 Starting memory cleanup...');

    // Cleanup event listeners
    this.cleanupEventListeners();

    // Execute all registered cleanup functions
    this.cleanupFunctions.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Error in cleanup function:', error);
      }
    });

    this.cleanupFunctions.clear();
    console.log('✅ Memory cleanup completed');
  }

  // Force garbage collection (if available)
  requestGarbageCollection(): boolean {
    if (typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
        console.log('🗑️ Garbage collection requested');
        return true;
      } catch (error) {
        console.warn('Failed to request garbage collection:', error);
      }
    }
    return false;
  }

  // Get memory usage info
  getMemoryInfo(): {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  // Check if memory usage is approaching limits
  isMemoryPressure(): boolean {
    const info = this.getMemoryInfo();
    if (!info) return false;
    
    // Consider memory pressure at 80% usage
    return info.percentage > 80;
  }

  // Clean up when memory pressure is detected
  handleMemoryPressure(): void {
    if (this.isMemoryPressure()) {
      console.warn('⚠️ Memory pressure detected, triggering cleanup');
      this.cleanup();
      this.requestGarbageCollection();
    }
  }
}

// Global memory manager instance
export const memoryManager = new MemoryManager();

// React hook for memory management
export function useMemoryManagement() {
  const registerCleanup = (fn: CleanupFunction) => {
    memoryManager.registerCleanup(fn);
  };

  const addEventListenerWithCleanup = (
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    memoryManager.addEventListener(element, event, handler, options);
  };

  const getMemoryInfo = () => {
    return memoryManager.getMemoryInfo();
  };

  const isMemoryPressure = () => {
    return memoryManager.isMemoryPressure();
  };

  const handleMemoryPressure = () => {
    memoryManager.handleMemoryPressure();
  };

  return {
    registerCleanup,
    addEventListenerWithCleanup,
    getMemoryInfo,
    isMemoryPressure,
    handleMemoryPressure
  };
}

export default MemoryManager;