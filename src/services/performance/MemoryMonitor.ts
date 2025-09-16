export interface MemoryInfo {
  used: number; // bytes
  total: number; // bytes
  limit: number; // bytes
  percentage: number; // percentage of limit used
}

export interface MemoryThresholds {
  warningThreshold: number; // bytes (35MB)
  criticalThreshold: number; // bytes (45MB)
  maxThreshold: number; // bytes (50MB)
}

export interface MemoryLeakAlert {
  timestamp: number;
  memoryUsage: number;
  growthRate: number; // bytes per minute
  message: string;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private isMonitoring = false;
  private memoryHistory: Array<{ timestamp: number; usage: number }> = [];
  private thresholds: MemoryThresholds;
  private alertCallback?: (alert: MemoryLeakAlert) => void;
  private monitoringInterval?: NodeJS.Timeout;

  private constructor() {
    this.thresholds = {
      warningThreshold: 35 * 1024 * 1024, // 35MB
      criticalThreshold: 45 * 1024 * 1024, // 45MB
      maxThreshold: 50 * 1024 * 1024 // 50MB
    };
  }

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, intervalMs);

    console.log('🧠 Memory monitoring started');
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('🧠 Memory monitoring stopped');
  }

  setAlertCallback(callback: (alert: MemoryLeakAlert) => void): void {
    this.alertCallback = callback;
  }

  getCurrentMemoryInfo(): MemoryInfo | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
      percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  private checkMemoryUsage(): void {
    const memoryInfo = this.getCurrentMemoryInfo();
    if (!memoryInfo) return;

    // Record memory usage history
    this.memoryHistory.push({
      timestamp: Date.now(),
      usage: memoryInfo.used
    });

    // Keep only last hour of data (720 entries at 5-second intervals)
    if (this.memoryHistory.length > 720) {
      this.memoryHistory = this.memoryHistory.slice(-720);
    }

    // Check for memory threshold violations
    this.checkThresholds(memoryInfo);

    // Check for potential memory leaks
    this.checkForMemoryLeaks(memoryInfo);
  }

  private checkThresholds(memoryInfo: MemoryInfo): void {
    const usageMB = memoryInfo.used / (1024 * 1024);

    if (memoryInfo.used >= this.thresholds.maxThreshold) {
      console.error(`🚨 CRITICAL: Memory usage (${usageMB.toFixed(2)}MB) exceeds maximum threshold`);
      this.triggerAlert({
        timestamp: Date.now(),
        memoryUsage: memoryInfo.used,
        growthRate: this.calculateGrowthRate(),
        message: `Critical memory usage: ${usageMB.toFixed(2)}MB`
      });
    } else if (memoryInfo.used >= this.thresholds.criticalThreshold) {
      console.warn(`⚠️ WARNING: Memory usage (${usageMB.toFixed(2)}MB) approaching critical threshold`);
    } else if (memoryInfo.used >= this.thresholds.warningThreshold) {
      console.warn(`⚡ Memory usage (${usageMB.toFixed(2)}MB) above warning threshold`);
    }
  }

  private checkForMemoryLeaks(memoryInfo: MemoryInfo): void {
    if (this.memoryHistory.length < 12) return; // Need at least 1 minute of data

    const growthRate = this.calculateGrowthRate();
    const growthRateMBPerMin = (growthRate / 1024 / 1024) * 60; // Convert to MB per minute

    // Alert if memory is growing consistently at >5MB per minute
    if (growthRateMBPerMin > 5) {
      const alert: MemoryLeakAlert = {
        timestamp: Date.now(),
        memoryUsage: memoryInfo.used,
        growthRate,
        message: `Potential memory leak detected: growing at ${growthRateMBPerMin.toFixed(2)}MB/min`
      };

      console.warn('🔍 Potential memory leak detected:', alert.message);
      this.triggerAlert(alert);
    }
  }

  private calculateGrowthRate(): number {
    if (this.memoryHistory.length < 2) return 0;

    // Calculate growth rate over last 5 minutes or available data
    const recentHistory = this.memoryHistory.slice(-60); // Last 5 minutes
    if (recentHistory.length < 2) return 0;

    const first = recentHistory[0];
    const last = recentHistory[recentHistory.length - 1];
    const timeDiff = (last.timestamp - first.timestamp) / 1000; // seconds
    const memoryDiff = last.usage - first.usage; // bytes

    return memoryDiff / timeDiff; // bytes per second
  }

  private triggerAlert(alert: MemoryLeakAlert): void {
    if (this.alertCallback) {
      this.alertCallback(alert);
    }
  }

  // Force garbage collection if available (Chrome DevTools)
  forceGarbageCollection(): boolean {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
        console.log('🗑️ Forced garbage collection');
        return true;
      } catch (e) {
        console.warn('Failed to force garbage collection:', e);
        return false;
      }
    }

    console.warn('Garbage collection not available. Enable --enable-precise-memory-info in Chrome flags.');
    return false;
  }

  // Get memory usage trends
  getMemoryTrends(durationMinutes: number = 10): {
    trend: 'increasing' | 'decreasing' | 'stable';
    averageUsage: number;
    peakUsage: number;
    growthRate: number;
    dataPoints: number;
  } {
    const cutoffTime = Date.now() - (durationMinutes * 60 * 1000);
    const relevantHistory = this.memoryHistory.filter(entry => entry.timestamp >= cutoffTime);

    if (relevantHistory.length < 2) {
      return {
        trend: 'stable',
        averageUsage: 0,
        peakUsage: 0,
        growthRate: 0,
        dataPoints: relevantHistory.length
      };
    }

    const usageValues = relevantHistory.map(entry => entry.usage);
    const averageUsage = usageValues.reduce((sum, usage) => sum + usage, 0) / usageValues.length;
    const peakUsage = Math.max(...usageValues);

    // Calculate trend
    const firstHalf = relevantHistory.slice(0, Math.floor(relevantHistory.length / 2));
    const secondHalf = relevantHistory.slice(Math.floor(relevantHistory.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, entry) => sum + entry.usage, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, entry) => sum + entry.usage, 0) / secondHalf.length;

    const growthRate = this.calculateGrowthRate();
    const growthThreshold = 1024 * 1024; // 1MB per second threshold

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (secondHalfAvg > firstHalfAvg + growthThreshold) {
      trend = 'increasing';
    } else if (secondHalfAvg < firstHalfAvg - growthThreshold) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      averageUsage,
      peakUsage,
      growthRate,
      dataPoints: relevantHistory.length
    };
  }

  // Generate memory report
  generateMemoryReport() {
    const current = this.getCurrentMemoryInfo();
    const trends = this.getMemoryTrends();
    const recommendations: string[] = [];

    if (current) {
      if (current.used > this.thresholds.warningThreshold) {
        recommendations.push('Consider implementing document pagination for large files');
        recommendations.push('Clear unused ProseMirror instances');
        recommendations.push('Optimize React component re-renders');
      }

      if (trends.trend === 'increasing') {
        recommendations.push('Investigate potential memory leaks in editor components');
        recommendations.push('Review event listener cleanup in useEffect hooks');
        recommendations.push('Consider implementing periodic garbage collection triggers');
      }

      if (current.percentage > 80) {
        recommendations.push('URGENT: Memory usage critical - implement immediate cleanup');
        recommendations.push('Consider warning users about large document sizes');
      }
    }

    return {
      current,
      trends,
      thresholds: this.thresholds,
      recommendations
    };
  }

  // Log detailed memory information
  logDetailedMemoryInfo(): void {
    const report = this.generateMemoryReport();
    
    console.group('🧠 Detailed Memory Report');
    
    if (report.current) {
      console.log(`Current Usage: ${(report.current.used / 1024 / 1024).toFixed(2)}MB (${report.current.percentage.toFixed(1)}%)`);
      console.log(`Total Allocated: ${(report.current.total / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory Limit: ${(report.current.limit / 1024 / 1024).toFixed(2)}MB`);
    } else {
      console.warn('Memory information not available');
    }

    console.log(`Trend (${report.trends.dataPoints} data points):`, report.trends.trend);
    console.log(`Average Usage: ${(report.trends.averageUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Peak Usage: ${(report.trends.peakUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`Growth Rate: ${(report.trends.growthRate / 1024).toFixed(2)}KB/sec`);

    if (report.recommendations.length > 0) {
      console.group('💡 Memory Recommendations');
      report.recommendations.forEach(rec => console.log(`• ${rec}`));
      console.groupEnd();
    }

    console.groupEnd();
  }
}

export default MemoryMonitor;