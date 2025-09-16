import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { simpleEditorSchema } from './SimpleEditorSchema';
import { simpleMarkdownService } from './SimpleMarkdownService';
import PerformanceService from '../performance/PerformanceService';
import ResponseTimeTracker from '../performance/ResponseTimeTracker';
import { memoryManager } from '../../utils/memory';

export interface EditorOptimizationConfig {
  enableDebouncing: boolean;
  debounceDelay: number; // ms
  enableVirtualization: boolean;
  virtualizationThreshold: number; // lines
  enableLazyRendering: boolean;
  renderBatchSize: number;
  enableMemoryOptimization: boolean;
  memoryCheckInterval: number; // ms
}

export interface DebouncedOperation {
  id: string;
  type: 'content' | 'selection' | 'formatting';
  timestamp: number;
  callback: () => void;
}

export class OptimizedEditorService {
  private static instance: OptimizedEditorService;
  private config: EditorOptimizationConfig;
  private performanceService: PerformanceService;
  private responseTimeTracker: ResponseTimeTracker;
  private debouncedOperations: Map<string, DebouncedOperation> = new Map();
  private renderQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  private frameId: number | null = null;

  private constructor() {
    this.config = {
      enableDebouncing: true,
      debounceDelay: 16, // 60fps
      enableVirtualization: true,
      virtualizationThreshold: 1000, // lines
      enableLazyRendering: true,
      renderBatchSize: 10,
      enableMemoryOptimization: true,
      memoryCheckInterval: 5000
    };

    this.performanceService = PerformanceService.getInstance();
    this.responseTimeTracker = ResponseTimeTracker.getInstance();
  }

  static getInstance(): OptimizedEditorService {
    if (!OptimizedEditorService.instance) {
      OptimizedEditorService.instance = new OptimizedEditorService();
    }
    return OptimizedEditorService.instance;
  }

  // Configure optimization settings
  configure(config: Partial<EditorOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Create optimized editor view
  createOptimizedView(
    dom: Element,
    state: EditorState,
    options: {
      dispatchTransaction?: (tr: Transaction) => void;
      onChange?: (content: string, doc: ProseMirrorNode) => void;
      onFocus?: () => void;
      onBlur?: () => void;
      readOnly?: boolean;
    } = {}
  ): EditorView {
    const operationId = this.performanceService.startOperation('createOptimizedView');

    try {
      const optimizedDispatch = this.createOptimizedDispatch(
        options.dispatchTransaction,
        options.onChange
      );

      const view = new EditorView(dom, {
        state,
        dispatchTransaction: optimizedDispatch,
        editable: () => !options.readOnly,
        handleDOMEvents: {
          focus: () => {
            const focusId = this.responseTimeTracker.startOperation('focus');
            options.onFocus?.();
            this.responseTimeTracker.endOperation(focusId, 'focus');
            return false;
          },
          blur: () => {
            const blurId = this.responseTimeTracker.startOperation('blur');
            options.onBlur?.();
            this.responseTimeTracker.endOperation(blurId, 'blur');
            return false;
          }
        },
        // Optimize scroll handling
        handleScrollToSelection: (view) => {
          return this.optimizedScrollToSelection(view);
        }
      });

      // Setup memory management
      if (this.config.enableMemoryOptimization) {
        this.setupMemoryManagement(view);
      }

      // Register cleanup
      memoryManager.registerProseMirrorInstance(view, () => {
        this.cleanup(view);
        view.destroy();
      });

      return view;
    } finally {
      this.performanceService.endOperation(operationId, 'createOptimizedView');
    }
  }

  // Create optimized dispatch function
  private createOptimizedDispatch(
    originalDispatch?: (tr: Transaction) => void,
    onChange?: (content: string, doc: ProseMirrorNode) => void
  ): (tr: Transaction) => void {
    return (transaction: Transaction) => {
      const operationId = this.responseTimeTracker.startOperation('dispatch');

      try {
        if (this.config.enableDebouncing) {
          this.debouncedDispatch(transaction, originalDispatch, onChange);
        } else {
          this.immediateDispatch(transaction, originalDispatch, onChange);
        }
      } finally {
        this.responseTimeTracker.endOperation(operationId, 'dispatch');
      }
    };
  }

  // Immediate dispatch for small changes
  private immediateDispatch(
    transaction: Transaction,
    originalDispatch?: (tr: Transaction) => void,
    onChange?: (content: string, doc: ProseMirrorNode) => void
  ): void {
    originalDispatch?.(transaction);

    if (transaction.docChanged && onChange) {
      const renderOperation = () => {
        const markdown = simpleMarkdownService.serializeToMarkdown(transaction.doc);
        onChange(markdown, transaction.doc);
      };

      if (this.config.enableLazyRendering) {
        this.queueRender(renderOperation);
      } else {
        renderOperation();
      }
    }
  }

  // Debounced dispatch for performance
  private debouncedDispatch(
    transaction: Transaction,
    originalDispatch?: (tr: Transaction) => void,
    onChange?: (content: string, doc: ProseMirrorNode) => void
  ): void {
    const operationType = this.classifyTransaction(transaction);
    const operationId = `${operationType}_${Date.now()}`;

    // Clear existing operation of same type
    const existingOperation = Array.from(this.debouncedOperations.values())
      .find(op => op.type === operationType);
    
    if (existingOperation) {
      this.debouncedOperations.delete(existingOperation.id);
    }

    // Create new debounced operation
    const debouncedOp: DebouncedOperation = {
      id: operationId,
      type: operationType,
      timestamp: Date.now(),
      callback: () => {
        this.immediateDispatch(transaction, originalDispatch, onChange);
        this.debouncedOperations.delete(operationId);
      }
    };

    this.debouncedOperations.set(operationId, debouncedOp);

    // Schedule execution
    setTimeout(() => {
      const op = this.debouncedOperations.get(operationId);
      if (op) {
        op.callback();
      }
    }, this.config.debounceDelay);
  }

  // Classify transaction for appropriate debouncing
  private classifyTransaction(transaction: Transaction): DebouncedOperation['type'] {
    if (transaction.docChanged) {
      // Check if this is formatting (small change) or content (large change)
      const changeSize = transaction.steps.reduce((size, step) => {
        return size + (step.toJSON().stepType === 'replace' ? 
          (step.toJSON().to - step.toJSON().from) : 0);
      }, 0);
      
      return changeSize < 10 ? 'formatting' : 'content';
    } else if (transaction.selectionSet) {
      return 'selection';
    } else {
      return 'formatting';
    }
  }

  // Queue render operations for batching
  private queueRender(operation: () => void): void {
    this.renderQueue.push(operation);
    
    if (!this.isProcessingQueue) {
      this.processRenderQueue();
    }
  }

  // Process render queue in batches
  private processRenderQueue(): void {
    if (this.renderQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    const processOperations = () => {
      const operationId = this.performanceService.startOperation('processRenderQueue');
      
      try {
        const batch = this.renderQueue.splice(0, this.config.renderBatchSize);
        batch.forEach(operation => {
          try {
            operation();
          } catch (error) {
            console.error('Error in render operation:', error);
          }
        });

        if (this.renderQueue.length > 0) {
          this.frameId = requestAnimationFrame(processOperations);
        } else {
          this.isProcessingQueue = false;
          this.frameId = null;
        }
      } finally {
        this.performanceService.endOperation(operationId, 'processRenderQueue');
      }
    };

    this.frameId = requestAnimationFrame(processOperations);
  }

  // Optimized scroll to selection
  private optimizedScrollToSelection(view: EditorView): boolean {
    const operationId = this.responseTimeTracker.startOperation('scrollToSelection');
    
    try {
      // Use native scrollIntoView with optimization
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);
      
      if (coords) {
        const element = view.dom.querySelector(`[data-pos="${from}"]`) || view.dom;
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest'
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Error in optimized scroll:', error);
      return false;
    } finally {
      this.responseTimeTracker.endOperation(operationId, 'scrollToSelection');
    }
  }

  // Setup memory management for editor
  private setupMemoryManagement(view: EditorView): void {
    const checkMemory = () => {
      const memoryInfo = memoryManager.getMemoryInfo();
      if (memoryInfo && memoryInfo.percentage > 75) {
        console.warn('🧠 High memory usage detected in editor');
        
        // Clear debounced operations
        this.clearDebouncedOperations();
        
        // Clear render queue
        this.clearRenderQueue();
        
        // Request garbage collection
        memoryManager.requestGarbageCollection();
      }
    };

    const memoryInterval = setInterval(checkMemory, this.config.memoryCheckInterval);
    
    memoryManager.registerCleanup(() => {
      clearInterval(memoryInterval);
    });
  }

  // Clear debounced operations
  private clearDebouncedOperations(): void {
    console.log('🧹 Clearing debounced operations');
    this.debouncedOperations.clear();
  }

  // Clear render queue
  private clearRenderQueue(): void {
    console.log('🧹 Clearing render queue');
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.renderQueue = [];
    this.isProcessingQueue = false;
  }

  // Cleanup editor resources
  private cleanup(view: EditorView): void {
    console.log('🧹 Cleaning up optimized editor');
    
    this.clearDebouncedOperations();
    this.clearRenderQueue();
    
    // Remove from memory manager
    memoryManager.cleanupProseMirrorInstance(view);
  }

  // Check if document should use virtualization
  shouldUseVirtualization(content: string): boolean {
    if (!this.config.enableVirtualization) return false;
    
    const lineCount = content.split('\n').length;
    return lineCount > this.config.virtualizationThreshold;
  }

  // Get optimization recommendations for content
  getOptimizationRecommendations(content: string): {
    useVirtualization: boolean;
    useLazyRendering: boolean;
    adjustDebouncing: boolean;
    estimatedMemoryUsage: number;
    recommendations: string[];
  } {
    const lineCount = content.split('\n').length;
    const contentSize = content.length;
    const estimatedMemoryUsage = contentSize * 4; // Rough estimate in bytes
    
    const recommendations: string[] = [];
    
    const useVirtualization = this.shouldUseVirtualization(content);
    if (useVirtualization) {
      recommendations.push('Use document virtualization for large content');
    }
    
    const useLazyRendering = contentSize > 100000; // 100KB
    if (useLazyRendering) {
      recommendations.push('Enable lazy rendering for better performance');
    }
    
    const adjustDebouncing = lineCount > 5000;
    if (adjustDebouncing) {
      recommendations.push('Increase debounce delay for large documents');
    }
    
    if (estimatedMemoryUsage > 10 * 1024 * 1024) { // 10MB
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider implementing document compression');
    }
    
    if (lineCount > 10000) {
      recommendations.push('Consider warning user about document size');
    }

    return {
      useVirtualization,
      useLazyRendering,
      adjustDebouncing,
      estimatedMemoryUsage,
      recommendations
    };
  }

  // Performance metrics for the editor
  getPerformanceMetrics(): {
    debouncedOperations: number;
    renderQueueSize: number;
    memoryUsage: number;
    averageRenderTime: number;
  } {
    const memoryInfo = memoryManager.getMemoryInfo();
    
    return {
      debouncedOperations: this.debouncedOperations.size,
      renderQueueSize: this.renderQueue.length,
      memoryUsage: memoryInfo ? memoryInfo.used : 0,
      averageRenderTime: 0 // Would need to track this
    };
  }
}

export default OptimizedEditorService;