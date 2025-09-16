import { PerformanceMonitor } from '../../utils/performance';

export interface PerformanceMetrics {
  loadTime: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
  };
  bundleSize?: number;
  typingLatency: number[];
  autoSaveDelay: number[];
  operationResponseTimes: Record<string, number[]>;
  documentSize?: number;
  renderingTime: number[];
}

export interface PerformanceThresholds {
  maxLoadTime: number; // 500ms
  maxMemoryUsage: number; // 50MB
  maxTypingLatency: number; // 100ms
  maxOperationTime: number; // 100ms
  maxAutoSaveDelay: number; // 2000ms
}

export class PerformanceService {
  private static instance: PerformanceService;
  private metrics: PerformanceMetrics;
  private thresholds: PerformanceThresholds;
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;

  private constructor() {
    this.thresholds = {
      maxLoadTime: 500,
      maxMemoryUsage: 50 * 1024 * 1024, // 50MB in bytes
      maxTypingLatency: 100,
      maxOperationTime: 100,
      maxAutoSaveDelay: 2000
    };

    this.metrics = this.initializeMetrics();
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      loadTime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        limit: 0
      },
      typingLatency: [],
      autoSaveDelay: [],
      operationResponseTimes: {},
      renderingTime: []
    };
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.setupPerformanceObservers();
    this.startMemoryMonitoring();
    this.measureLoadTime();
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  private setupPerformanceObservers(): void {
    // Observe navigation timing
    if ('PerformanceObserver' in window) {
      const navigationObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.metrics.loadTime = navEntry.loadEventEnd - navEntry.startTime;
          }
        });
      });

      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navigationObserver);
      } catch (e) {
        console.warn('Navigation timing observer not supported');
      }

      // Observe measure entries
      const measureObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'measure') {
            this.recordOperationTime(entry.name, entry.duration);
          }
        });
      });

      try {
        measureObserver.observe({ entryTypes: ['measure'] });
        this.observers.push(measureObserver);
      } catch (e) {
        console.warn('Measure observer not supported');
      }
    }
  }

  private startMemoryMonitoring(): void {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        this.metrics.memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        };
      }
    };

    updateMemory();
    setInterval(updateMemory, 5000); // Update every 5 seconds
  }

  private measureLoadTime(): void {
    if (document.readyState === 'complete') {
      this.metrics.loadTime = performance.now();
    } else {
      window.addEventListener('load', () => {
        this.metrics.loadTime = performance.now();
      });
    }
  }

  // Typing latency measurement
  measureTypingStart(): string {
    const id = `typing_${Date.now()}_${Math.random()}`;
    performance.mark(`${id}_start`);
    return id;
  }

  measureTypingEnd(id: string): number {
    performance.mark(`${id}_end`);
    performance.measure(id, `${id}_start`, `${id}_end`);
    
    const entries = performance.getEntriesByName(id, 'measure');
    if (entries.length > 0) {
      const latency = entries[0].duration;
      this.metrics.typingLatency.push(latency);
      
      // Keep only last 100 measurements
      if (this.metrics.typingLatency.length > 100) {
        this.metrics.typingLatency = this.metrics.typingLatency.slice(-100);
      }
      
      performance.clearMarks(`${id}_start`);
      performance.clearMarks(`${id}_end`);
      performance.clearMeasures(id);
      
      return latency;
    }
    
    return 0;
  }

  // Operation timing
  startOperation(operationName: string): string {
    const id = `${operationName}_${Date.now()}_${Math.random()}`;
    try {
      performance.mark(`${id}_start`);
    } catch (error) {
      // Performance API not available (e.g., in test environment)
    }
    return id;
  }

  endOperation(id: string, operationName: string): number {
    try {
      performance.mark(`${id}_end`);
      performance.measure(id, `${id}_start`, `${id}_end`);
      
      const entries = performance.getEntriesByName?.(id, 'measure') || [];
      if (entries.length > 0) {
        const duration = entries[0].duration;
        this.recordOperationTime(operationName, duration);
        
        if (performance.clearMarks) {
          performance.clearMarks(`${id}_start`);
          performance.clearMarks(`${id}_end`);
        }
        if (performance.clearMeasures) {
          performance.clearMeasures(id);
        }
        
        return duration;
      }
    } catch (error) {
      // Performance API not available (e.g., in test environment)
    }
    
    return 0;
  }

  private recordOperationTime(operationName: string, duration: number): void {
    if (!this.metrics.operationResponseTimes[operationName]) {
      this.metrics.operationResponseTimes[operationName] = [];
    }
    
    this.metrics.operationResponseTimes[operationName].push(duration);
    
    // Keep only last 50 measurements per operation
    if (this.metrics.operationResponseTimes[operationName].length > 50) {
      this.metrics.operationResponseTimes[operationName] = 
        this.metrics.operationResponseTimes[operationName].slice(-50);
    }
  }

  // Auto-save timing
  recordAutoSaveTime(duration: number): void {
    this.metrics.autoSaveDelay.push(duration);
    
    // Keep only last 20 measurements
    if (this.metrics.autoSaveDelay.length > 20) {
      this.metrics.autoSaveDelay = this.metrics.autoSaveDelay.slice(-20);
    }
  }

  // Document size tracking
  updateDocumentSize(size: number): void {
    this.metrics.documentSize = size;
  }

  // Rendering time tracking
  recordRenderTime(duration: number): void {
    this.metrics.renderingTime.push(duration);
    
    // Keep only last 50 measurements
    if (this.metrics.renderingTime.length > 50) {
      this.metrics.renderingTime = this.metrics.renderingTime.slice(-50);
    }
  }

  // Performance analysis
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getPerformanceReport(): {
    metrics: PerformanceMetrics;
    violations: string[];
    recommendations: string[];
  } {
    const violations: string[] = [];
    const recommendations: string[] = [];

    // Check load time
    if (this.metrics.loadTime > this.thresholds.maxLoadTime) {
      violations.push(`Load time (${this.metrics.loadTime.toFixed(2)}ms) exceeds ${this.thresholds.maxLoadTime}ms threshold`);
      recommendations.push('Consider code splitting and lazy loading');
    }

    // Check memory usage
    const memoryUsageMB = this.metrics.memoryUsage.used / (1024 * 1024);
    if (this.metrics.memoryUsage.used > this.thresholds.maxMemoryUsage) {
      violations.push(`Memory usage (${memoryUsageMB.toFixed(2)}MB) exceeds ${(this.thresholds.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB threshold`);
      recommendations.push('Implement memory cleanup and optimize large document handling');
    }

    // Check typing latency
    const avgTypingLatency = this.getAverageTypingLatency();
    if (avgTypingLatency > this.thresholds.maxTypingLatency) {
      violations.push(`Average typing latency (${avgTypingLatency.toFixed(2)}ms) exceeds ${this.thresholds.maxTypingLatency}ms threshold`);
      recommendations.push('Optimize editor rendering and debounce DOM updates');
    }

    // Check operation times
    Object.entries(this.metrics.operationResponseTimes).forEach(([operation, times]) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      if (avgTime > this.thresholds.maxOperationTime) {
        violations.push(`Average ${operation} time (${avgTime.toFixed(2)}ms) exceeds ${this.thresholds.maxOperationTime}ms threshold`);
        recommendations.push(`Optimize ${operation} operation`);
      }
    });

    return {
      metrics: this.metrics,
      violations,
      recommendations
    };
  }

  private getAverageTypingLatency(): number {
    if (this.metrics.typingLatency.length === 0) return 0;
    return this.metrics.typingLatency.reduce((sum, latency) => sum + latency, 0) / this.metrics.typingLatency.length;
  }

  // Get performance summary for display
  getPerformanceSummary(): {
    status: 'good' | 'warning' | 'critical';
    summary: string;
    details: Array<{ metric: string; value: string; status: 'good' | 'warning' | 'critical' }>;
  } {
    const report = this.getPerformanceReport();
    const details: Array<{ metric: string; value: string; status: 'good' | 'warning' | 'critical' }> = [];

    // Load time
    const loadTimeStatus = this.metrics.loadTime <= this.thresholds.maxLoadTime ? 'good' : 
                          this.metrics.loadTime <= this.thresholds.maxLoadTime * 1.5 ? 'warning' : 'critical';
    details.push({
      metric: 'Load Time',
      value: `${this.metrics.loadTime.toFixed(2)}ms`,
      status: loadTimeStatus
    });

    // Memory usage
    const memoryUsageMB = this.metrics.memoryUsage.used / (1024 * 1024);
    const memoryStatus = memoryUsageMB <= 50 ? 'good' : memoryUsageMB <= 75 ? 'warning' : 'critical';
    details.push({
      metric: 'Memory Usage',
      value: `${memoryUsageMB.toFixed(2)}MB`,
      status: memoryStatus
    });

    // Typing latency
    const avgTypingLatency = this.getAverageTypingLatency();
    const typingStatus = avgTypingLatency <= this.thresholds.maxTypingLatency ? 'good' : 
                        avgTypingLatency <= this.thresholds.maxTypingLatency * 1.5 ? 'warning' : 'critical';
    details.push({
      metric: 'Typing Latency',
      value: `${avgTypingLatency.toFixed(2)}ms`,
      status: typingStatus
    });

    // Overall status
    const criticalCount = details.filter(d => d.status === 'critical').length;
    const warningCount = details.filter(d => d.status === 'warning').length;
    
    const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'good';
    const summary = `${report.violations.length} performance violations detected`;

    return {
      status: overallStatus,
      summary,
      details
    };
  }

  // Performance debugging
  logPerformanceMetrics(): void {
    console.group('📊 Enhanced Performance Metrics');
    console.log('Load time:', `${this.metrics.loadTime.toFixed(2)}ms`);
    console.log('Memory usage:', `${(this.metrics.memoryUsage.used / 1024 / 1024).toFixed(2)}MB`);
    console.log('Average typing latency:', `${this.getAverageTypingLatency().toFixed(2)}ms`);
    
    Object.entries(this.metrics.operationResponseTimes).forEach(([operation, times]) => {
      const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      console.log(`Average ${operation} time:`, `${avgTime.toFixed(2)}ms`);
    });

    if (this.metrics.documentSize) {
      console.log('Document size:', `${(this.metrics.documentSize / 1024).toFixed(2)}KB`);
    }

    console.groupEnd();

    const report = this.getPerformanceReport();
    if (report.violations.length > 0) {
      console.group('⚠️ Performance Violations');
      report.violations.forEach(violation => console.warn(violation));
      console.groupEnd();

      console.group('💡 Recommendations');
      report.recommendations.forEach(rec => console.log(rec));
      console.groupEnd();
    }
  }
}

export default PerformanceService;