export interface ResponseTimeEntry {
  timestamp: number;
  duration: number;
  operation: string;
  details?: Record<string, any>;
}

export interface ResponseTimeMetrics {
  operation: string;
  count: number;
  average: number;
  min: number;
  max: number;
  percentile95: number;
  recentAverage: number; // Last 10 measurements
}

export interface ResponseTimeAlert {
  timestamp: number;
  operation: string;
  duration: number;
  threshold: number;
  message: string;
}

export class ResponseTimeTracker {
  private static instance: ResponseTimeTracker;
  private measurements: Map<string, ResponseTimeEntry[]> = new Map();
  private thresholds: Map<string, number> = new Map();
  private defaultThreshold = 100; // 100ms default
  private alertCallback?: (alert: ResponseTimeAlert) => void;
  private activeOperations: Map<string, { startTime: number; details?: Record<string, any> }> = new Map();

  private constructor() {
    // Set default thresholds for common operations
    this.thresholds.set('typing', 50);
    this.thresholds.set('formatting', 100);
    this.thresholds.set('shortcut', 50);
    this.thresholds.set('save', 2000);
    this.thresholds.set('load', 500);
    this.thresholds.set('render', 16); // 60fps = 16ms per frame
    this.thresholds.set('scroll', 16);
    this.thresholds.set('focus', 100);
    this.thresholds.set('blur', 100);
    this.thresholds.set('undo', 100);
    this.thresholds.set('redo', 100);
    this.thresholds.set('search', 200);
    this.thresholds.set('replace', 200);
  }

  static getInstance(): ResponseTimeTracker {
    if (!ResponseTimeTracker.instance) {
      ResponseTimeTracker.instance = new ResponseTimeTracker();
    }
    return ResponseTimeTracker.instance;
  }

  setAlertCallback(callback: (alert: ResponseTimeAlert) => void): void {
    this.alertCallback = callback;
  }

  setThreshold(operation: string, thresholdMs: number): void {
    this.thresholds.set(operation, thresholdMs);
  }

  startOperation(operation: string, details?: Record<string, any>): string {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeOperations.set(operationId, {
      startTime: performance.now(),
      details
    });

    return operationId;
  }

  endOperation(operationId: string, operationName?: string): number | null {
    const operationData = this.activeOperations.get(operationId);
    if (!operationData) {
      console.warn(`Operation ${operationId} not found or already completed`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - operationData.startTime;
    const operation = operationName || operationId.split('_')[0];

    // Record the measurement
    this.recordMeasurement(operation, duration, operationData.details);

    // Clean up
    this.activeOperations.delete(operationId);

    return duration;
  }

  // Direct measurement for simple operations
  measureOperation<T>(operation: string, fn: () => T, details?: Record<string, any>): { result: T; duration: number } {
    const startTime = performance.now();
    const result = fn();
    const duration = performance.now() - startTime;

    this.recordMeasurement(operation, duration, details);

    return { result, duration };
  }

  // Async operation measurement
  async measureAsyncOperation<T>(
    operation: string, 
    fn: () => Promise<T>, 
    details?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;

    this.recordMeasurement(operation, duration, details);

    return { result, duration };
  }

  private recordMeasurement(operation: string, duration: number, details?: Record<string, any>): void {
    const entry: ResponseTimeEntry = {
      timestamp: Date.now(),
      duration,
      operation,
      details
    };

    if (!this.measurements.has(operation)) {
      this.measurements.set(operation, []);
    }

    const measurements = this.measurements.get(operation)!;
    measurements.push(entry);

    // Keep only last 1000 measurements per operation
    if (measurements.length > 1000) {
      measurements.splice(0, measurements.length - 1000);
    }

    // Check threshold and alert if necessary
    this.checkThreshold(operation, duration);
  }

  private checkThreshold(operation: string, duration: number): void {
    const threshold = this.thresholds.get(operation) || this.defaultThreshold;
    
    if (duration > threshold) {
      const alert: ResponseTimeAlert = {
        timestamp: Date.now(),
        operation,
        duration,
        threshold,
        message: `${operation} operation took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`
      };

      console.warn(`⏱️ Response time alert: ${alert.message}`);
      
      if (this.alertCallback) {
        this.alertCallback(alert);
      }
    }
  }

  getMetrics(operation: string): ResponseTimeMetrics | null {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const sum = durations.reduce((total, duration) => total + duration, 0);
    const average = sum / count;
    const min = durations[0];
    const max = durations[count - 1];

    // Calculate 95th percentile
    const p95Index = Math.ceil(count * 0.95) - 1;
    const percentile95 = durations[p95Index] || max;

    // Calculate recent average (last 10 measurements)
    const recentMeasurements = measurements.slice(-10);
    const recentSum = recentMeasurements.reduce((total, m) => total + m.duration, 0);
    const recentAverage = recentSum / recentMeasurements.length;

    return {
      operation,
      count,
      average,
      min,
      max,
      percentile95,
      recentAverage
    };
  }

  getAllMetrics(): ResponseTimeMetrics[] {
    const allMetrics: ResponseTimeMetrics[] = [];
    
    for (const operation of this.measurements.keys()) {
      const metrics = this.getMetrics(operation);
      if (metrics) {
        allMetrics.push(metrics);
      }
    }

    return allMetrics.sort((a, b) => b.count - a.count); // Sort by frequency
  }

  // Get slow operations (above threshold)
  getSlowOperations(timeWindowMs: number = 60000): Array<{
    operation: string;
    violations: ResponseTimeEntry[];
    averageViolation: number;
  }> {
    const cutoffTime = Date.now() - timeWindowMs;
    const slowOperations: Array<{
      operation: string;
      violations: ResponseTimeEntry[];
      averageViolation: number;
    }> = [];

    for (const [operation, measurements] of this.measurements.entries()) {
      const threshold = this.thresholds.get(operation) || this.defaultThreshold;
      const recentMeasurements = measurements.filter(m => m.timestamp >= cutoffTime);
      const violations = recentMeasurements.filter(m => m.duration > threshold);

      if (violations.length > 0) {
        const averageViolation = violations.reduce((sum, v) => sum + v.duration, 0) / violations.length;
        slowOperations.push({
          operation,
          violations,
          averageViolation
        });
      }
    }

    return slowOperations.sort((a, b) => b.averageViolation - a.averageViolation);
  }

  // Performance trend analysis
  getPerformanceTrends(operation: string, timeWindowMs: number = 300000): {
    trend: 'improving' | 'degrading' | 'stable';
    recentAverage: number;
    historicalAverage: number;
    changePercentage: number;
  } {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length < 10) {
      return {
        trend: 'stable',
        recentAverage: 0,
        historicalAverage: 0,
        changePercentage: 0
      };
    }

    const cutoffTime = Date.now() - timeWindowMs;
    const recentMeasurements = measurements.filter(m => m.timestamp >= cutoffTime);
    const historicalMeasurements = measurements.filter(m => m.timestamp < cutoffTime);

    if (recentMeasurements.length === 0 || historicalMeasurements.length === 0) {
      return {
        trend: 'stable',
        recentAverage: 0,
        historicalAverage: 0,
        changePercentage: 0
      };
    }

    const recentAverage = recentMeasurements.reduce((sum, m) => sum + m.duration, 0) / recentMeasurements.length;
    const historicalAverage = historicalMeasurements.reduce((sum, m) => sum + m.duration, 0) / historicalMeasurements.length;

    const changePercentage = ((recentAverage - historicalAverage) / historicalAverage) * 100;
    
    let trend: 'improving' | 'degrading' | 'stable';
    if (changePercentage > 10) {
      trend = 'degrading';
    } else if (changePercentage < -10) {
      trend = 'improving';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      recentAverage,
      historicalAverage,
      changePercentage
    };
  }

  // Generate comprehensive report
  generateReport(timeWindowMs: number = 300000): {
    summary: {
      totalOperations: number;
      totalMeasurements: number;
      slowOperations: number;
      averageResponseTime: number;
    };
    metrics: ResponseTimeMetrics[];
    slowOperations: Array<{
      operation: string;
      violations: ResponseTimeEntry[];
      averageViolation: number;
    }>;
    trends: Array<{
      operation: string;
      trend: 'improving' | 'degrading' | 'stable';
      changePercentage: number;
    }>;
    recommendations: string[];
  } {
    const metrics = this.getAllMetrics();
    const slowOperations = this.getSlowOperations(timeWindowMs);
    
    const totalOperations = metrics.length;
    const totalMeasurements = metrics.reduce((sum, m) => sum + m.count, 0);
    const averageResponseTime = metrics.reduce((sum, m) => sum + (m.average * m.count), 0) / totalMeasurements;

    const trends = metrics.map(m => {
      const trend = this.getPerformanceTrends(m.operation, timeWindowMs);
      return {
        operation: m.operation,
        trend: trend.trend,
        changePercentage: trend.changePercentage
      };
    });

    const recommendations: string[] = [];

    // Generate recommendations based on analysis
    if (slowOperations.length > 0) {
      recommendations.push(`${slowOperations.length} operations are consistently slow`);
      slowOperations.slice(0, 3).forEach(slow => {
        recommendations.push(`Optimize ${slow.operation} - averaging ${slow.averageViolation.toFixed(2)}ms`);
      });
    }

    const degradingTrends = trends.filter(t => t.trend === 'degrading');
    if (degradingTrends.length > 0) {
      recommendations.push(`${degradingTrends.length} operations showing performance degradation`);
      degradingTrends.slice(0, 3).forEach(trend => {
        recommendations.push(`Investigate ${trend.operation} performance regression (${trend.changePercentage.toFixed(1)}% slower)`);
      });
    }

    return {
      summary: {
        totalOperations,
        totalMeasurements,
        slowOperations: slowOperations.length,
        averageResponseTime
      },
      metrics,
      slowOperations,
      trends,
      recommendations
    };
  }

  // Clear old data
  clearOldData(ageMs: number = 3600000): void { // Default 1 hour
    const cutoffTime = Date.now() - ageMs;
    
    for (const [operation, measurements] of this.measurements.entries()) {
      const filteredMeasurements = measurements.filter(m => m.timestamp >= cutoffTime);
      if (filteredMeasurements.length === 0) {
        this.measurements.delete(operation);
      } else {
        this.measurements.set(operation, filteredMeasurements);
      }
    }
  }

  // Log performance report
  logPerformanceReport(): void {
    const report = this.generateReport();
    
    console.group('⏱️ Response Time Performance Report');
    console.log(`Total Operations: ${report.summary.totalOperations}`);
    console.log(`Total Measurements: ${report.summary.totalMeasurements}`);
    console.log(`Slow Operations: ${report.summary.slowOperations}`);
    console.log(`Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    
    if (report.metrics.length > 0) {
      console.group('📊 Operation Metrics');
      report.metrics.forEach(m => {
        const threshold = this.thresholds.get(m.operation) || this.defaultThreshold;
        const status = m.average <= threshold ? '✅' : '⚠️';
        console.log(`${status} ${m.operation}: avg=${m.average.toFixed(2)}ms, p95=${m.percentile95.toFixed(2)}ms (${m.count} samples)`);
      });
      console.groupEnd();
    }

    if (report.slowOperations.length > 0) {
      console.group('⚠️ Slow Operations');
      report.slowOperations.forEach(slow => {
        console.warn(`${slow.operation}: ${slow.violations.length} violations, avg=${slow.averageViolation.toFixed(2)}ms`);
      });
      console.groupEnd();
    }

    if (report.recommendations.length > 0) {
      console.group('💡 Recommendations');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }

    console.groupEnd();
  }
}

export default ResponseTimeTracker;