export interface LoadTimeMetrics {
  navigationStart: number;
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  totalLoadTime: number;
}

export interface BundleMetrics {
  estimatedSize: number; // bytes
  resourceCount: number;
  scriptCount: number;
  styleCount: number;
  resourceSizes: Array<{ name: string; size: number; type: string }>;
}

// Enhanced performance monitoring utilities
export class PerformanceMonitor {
  private static startTime = performance.now();
  private static metrics: Map<string, number> = new Map();
  private static loadTimeMetrics: LoadTimeMetrics | null = null;
  private static bundleMetrics: BundleMetrics | null = null;

  static markStart(label: string): void {
    this.metrics.set(`${label}_start`, performance.now());
  }

  static markEnd(label: string): number {
    const startTime = this.metrics.get(`${label}_start`);
    if (!startTime) {
      console.warn(`Performance mark "${label}_start" not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.metrics.set(label, duration);
    
    return duration;
  }

  static getInitializationTime(): number {
    return performance.now() - this.startTime;
  }

  // Enhanced load time monitoring
  static measureLoadTimes(): LoadTimeMetrics {
    if (this.loadTimeMetrics) {
      return this.loadTimeMetrics;
    }

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');

    let firstContentfulPaint: number | undefined;
    let largestContentfulPaint: number | undefined;

    paintEntries.forEach((entry) => {
      if (entry.name === 'first-contentful-paint') {
        firstContentfulPaint = entry.startTime;
      }
    });

    // Try to get LCP from PerformanceObserver if available
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            largestContentfulPaint = lastEntry.startTime;
          }
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP not supported
      }
    }

    this.loadTimeMetrics = {
      navigationStart: navigation.startTime,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
      loadComplete: navigation.loadEventEnd - navigation.startTime,
      firstContentfulPaint,
      largestContentfulPaint,
      totalLoadTime: performance.now() - this.startTime
    };

    return this.loadTimeMetrics;
  }

  // Bundle size monitoring
  static analyzeBundleSize(): BundleMetrics {
    if (this.bundleMetrics) {
      return this.bundleMetrics;
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    let totalSize = 0;
    let scriptCount = 0;
    let styleCount = 0;
    const resourceSizes: Array<{ name: string; size: number; type: string }> = [];

    resources.forEach((resource) => {
      const size = resource.transferSize || resource.encodedBodySize || 0;
      totalSize += size;

      let type = 'other';
      if (resource.name.endsWith('.js') || resource.name.includes('javascript')) {
        type = 'script';
        scriptCount++;
      } else if (resource.name.endsWith('.css') || resource.name.includes('stylesheet')) {
        type = 'style';
        styleCount++;
      } else if (resource.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
        type = 'image';
      } else if (resource.name.match(/\.(woff|woff2|ttf|eot)$/i)) {
        type = 'font';
      }

      resourceSizes.push({
        name: resource.name,
        size,
        type
      });
    });

    this.bundleMetrics = {
      estimatedSize: totalSize,
      resourceCount: resources.length,
      scriptCount,
      styleCount,
      resourceSizes: resourceSizes.sort((a, b) => b.size - a.size)
    };

    return this.bundleMetrics;
  }

  // Get comprehensive performance report
  static getComprehensiveReport(): {
    loadTimes: LoadTimeMetrics;
    bundleInfo: BundleMetrics;
    memoryUsage: { used: number; total: number; limit: number } | null;
    customMetrics: Array<{ name: string; value: number }>;
    thresholdViolations: string[];
    recommendations: string[];
  } {
    const loadTimes = this.measureLoadTimes();
    const bundleInfo = this.analyzeBundleSize();
    
    let memoryUsage = null;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }

    const customMetrics: Array<{ name: string; value: number }> = [];
    this.metrics.forEach((value, key) => {
      if (!key.endsWith('_start')) {
        customMetrics.push({ name: key, value });
      }
    });

    const thresholdViolations: string[] = [];
    const recommendations: string[] = [];

    // Check thresholds and generate recommendations
    if (loadTimes.totalLoadTime > 500) {
      thresholdViolations.push(`Load time (${loadTimes.totalLoadTime.toFixed(2)}ms) exceeds 500ms target`);
      recommendations.push('Consider code splitting and lazy loading');
    }

    if (bundleInfo.estimatedSize > 2 * 1024 * 1024) { // 2MB
      thresholdViolations.push(`Bundle size (${(bundleInfo.estimatedSize / 1024 / 1024).toFixed(2)}MB) exceeds 2MB target`);
      recommendations.push('Implement tree shaking and remove unused dependencies');
    }

    if (memoryUsage && memoryUsage.used > 50 * 1024 * 1024) { // 50MB
      thresholdViolations.push(`Memory usage (${(memoryUsage.used / 1024 / 1024).toFixed(2)}MB) exceeds 50MB target`);
      recommendations.push('Optimize memory usage and implement cleanup');
    }

    if (bundleInfo.scriptCount > 10) {
      recommendations.push('Consider bundling JavaScript files to reduce HTTP requests');
    }

    if (loadTimes.firstContentfulPaint && loadTimes.firstContentfulPaint > 1000) {
      recommendations.push('Optimize critical rendering path for faster FCP');
    }

    return {
      loadTimes,
      bundleInfo,
      memoryUsage,
      customMetrics,
      thresholdViolations,
      recommendations
    };
  }

  static reportMetrics(): void {
    const report = this.getComprehensiveReport();
    
    // Only log critical performance issues
    if (report.thresholdViolations.length > 0) {
      console.group('⚠️ Performance Issues');
      report.thresholdViolations.forEach(violation => console.warn(violation));
      console.groupEnd();
    }
  }

  static checkMemoryUsage(): void {
    // Memory usage check simplified
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize / 1024 / 1024;
      const limit = memory.jsHeapSizeLimit / 1024 / 1024;
      const percentage = (used / limit) * 100;
      
      if (percentage > 80) {
        console.warn(`⚠️ High memory usage: ${used.toFixed(1)}MB (${percentage.toFixed(1)}%)`);
      }
    }
  }

  // Get performance data for external monitoring
  static getPerformanceData(): {
    loadTime: number;
    bundleSize: number;
    memoryUsed: number;
    resourceCount: number;
  } {
    const loadTimes = this.measureLoadTimes();
    const bundleInfo = this.analyzeBundleSize();
    
    let memoryUsed = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsed = memory.usedJSHeapSize;
    }

    return {
      loadTime: loadTimes.totalLoadTime,
      bundleSize: bundleInfo.estimatedSize,
      memoryUsed,
      resourceCount: bundleInfo.resourceCount
    };
  }
}

// Auto-report performance after page load
window.addEventListener('load', () => {
  setTimeout(() => {
    PerformanceMonitor.reportMetrics();
    PerformanceMonitor.checkMemoryUsage();
  }, 100);
});

export default PerformanceMonitor;