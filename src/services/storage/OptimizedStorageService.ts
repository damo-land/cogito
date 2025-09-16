import { compressionService, CompressionResult, DecompressionResult } from '../../utils/compression';
import PerformanceService from '../performance/PerformanceService';
import ResponseTimeTracker from '../performance/ResponseTimeTracker';

export interface StorageConfig {
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  enableBackgroundOperations: boolean;
  maxRetries: number;
  retryDelay: number; // ms
  enableCaching: boolean;
  maxCacheSize: number; // items
  cacheTTL: number; // ms
}

export interface StorageItem {
  id: string;
  content: string;
  metadata: {
    created: number;
    modified: number;
    size: number;
    compressed: boolean;
    version: number;
  };
}

export interface BackgroundOperation {
  id: string;
  type: 'save' | 'load' | 'delete';
  priority: 'high' | 'normal' | 'low';
  data: any;
  callback?: (result: any) => void;
  errorCallback?: (error: Error) => void;
  timestamp: number;
  retryCount: number;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  accessCount: number;
  size: number;
}

export class OptimizedStorageService {
  private static instance: OptimizedStorageService;
  private config: StorageConfig;
  private performanceService: PerformanceService;
  private responseTimeTracker: ResponseTimeTracker;
  private operationQueue: BackgroundOperation[] = [];
  private cache: Map<string, CacheEntry> = new Map();
  private cacheSize = 0;
  private isProcessingQueue = false;
  private workers: Worker[] = [];
  private dbName = 'wysiwyg-md-editor';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  private constructor() {
    this.config = {
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      enableBackgroundOperations: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableCaching: true,
      maxCacheSize: 50,
      cacheTTL: 300000 // 5 minutes
    };

    this.performanceService = PerformanceService.getInstance();
    this.responseTimeTracker = ResponseTimeTracker.getInstance();
    
    this.initializeDatabase();
  }

  static getInstance(): OptimizedStorageService {
    if (!OptimizedStorageService.instance) {
      OptimizedStorageService.instance = new OptimizedStorageService();
    }
    return OptimizedStorageService.instance;
  }

  // Configure storage settings
  configure(config: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Initialize IndexedDB with optimizations
  private async initializeDatabase(): Promise<void> {
    const operationId = this.performanceService.startOperation('initializeDatabase');

    try {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, this.dbVersion);

        request.onerror = () => {
          console.error('Database initialization failed:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('📁 Optimized database initialized');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Create object stores with optimized indexes
          if (!db.objectStoreNames.contains('documents')) {
            const store = db.createObjectStore('documents', { keyPath: 'id' });
            
            // Indexes for efficient querying
            store.createIndex('modified', 'metadata.modified', { unique: false });
            store.createIndex('size', 'metadata.size', { unique: false });
            store.createIndex('created', 'metadata.created', { unique: false });
            store.createIndex('compressed', 'metadata.compressed', { unique: false });
          }

          // Create store for metadata and settings
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        };
      });
    } finally {
      this.performanceService.endOperation(operationId, 'initializeDatabase');
    }
  }

  // Optimized save operation
  async save(id: string, content: string, options: {
    background?: boolean;
    priority?: 'high' | 'normal' | 'low';
    compress?: boolean;
  } = {}): Promise<StorageItem> {
    const trackingId = this.responseTimeTracker.startOperation('save');

    try {
      if (options.background && this.config.enableBackgroundOperations) {
        return this.queueBackgroundOperation({
          id: `save_${id}_${Date.now()}`,
          type: 'save',
          priority: options.priority || 'normal',
          data: { id, content, options },
          timestamp: Date.now(),
          retryCount: 0
        });
      }

      return await this.performSave(id, content, options);
    } finally {
      this.responseTimeTracker.endOperation(trackingId, 'save');
    }
  }

  // Actual save implementation
  private async performSave(id: string, content: string, options: {
    compress?: boolean;
  } = {}): Promise<StorageItem> {
    const operationId = this.performanceService.startOperation('performSave');

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      const shouldCompress = options.compress ?? 
        (this.config.enableCompression && content.length >= this.config.compressionThreshold);

      let finalContent = content;
      let compressed = false;

      if (shouldCompress) {
        const compressionResult = await compressionService.compress(content);
        if (compressionResult.compressionRatio > 1.1) { // Only use if 10%+ savings
          finalContent = compressionResult.compressed;
          compressed = true;
        }
      }

      const storageItem: StorageItem = {
        id,
        content: finalContent,
        metadata: {
          created: Date.now(),
          modified: Date.now(),
          size: content.length,
          compressed,
          version: 1
        }
      };

      // Check if item already exists to update metadata
      const existingItem = await this.getFromDatabase(id);
      if (existingItem) {
        storageItem.metadata.created = existingItem.metadata.created;
        storageItem.metadata.version = existingItem.metadata.version + 1;
      }

      await this.saveToDatabase(storageItem);

      // Update cache
      if (this.config.enableCaching) {
        this.updateCache(id, storageItem);
      }

      this.performanceService.recordAutoSaveTime(Date.now() - storageItem.metadata.modified);

      return storageItem;
    } finally {
      this.performanceService.endOperation(operationId, 'performSave');
    }
  }

  // Optimized load operation
  async load(id: string, options: {
    useCache?: boolean;
    background?: boolean;
  } = {}): Promise<StorageItem | null> {
    const trackingId = this.responseTimeTracker.startOperation('load');

    try {
      // Check cache first
      if (options.useCache !== false && this.config.enableCaching) {
        const cached = this.getFromCache(id);
        if (cached) {
          return cached as StorageItem;
        }
      }

      if (options.background && this.config.enableBackgroundOperations) {
        return this.queueBackgroundOperation({
          id: `load_${id}_${Date.now()}`,
          type: 'load',
          priority: 'normal',
          data: { id, options },
          timestamp: Date.now(),
          retryCount: 0
        });
      }

      return await this.performLoad(id);
    } finally {
      this.responseTimeTracker.endOperation(trackingId, 'load');
    }
  }

  // Actual load implementation
  private async performLoad(id: string): Promise<StorageItem | null> {
    const operationId = this.performanceService.startOperation('performLoad');

    try {
      const item = await this.getFromDatabase(id);
      if (!item) return null;

      // Decompress if needed
      if (item.metadata.compressed) {
        const decompressed = await compressionService.decompress(item.content);
        item.content = decompressed.decompressed;
      }

      // Update cache
      if (this.config.enableCaching) {
        this.updateCache(id, item);
      }

      return item;
    } finally {
      this.performanceService.endOperation(operationId, 'performLoad');
    }
  }

  // Database operations with error handling
  private async saveToDatabase(item: StorageItem): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['documents'], 'readwrite');
      const store = transaction.objectStore('documents');
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);

      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async getFromDatabase(id: string): Promise<StorageItem | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['documents'], 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Background operation queue management
  private async queueBackgroundOperation(operation: BackgroundOperation): Promise<any> {
    this.operationQueue.push(operation);
    this.operationQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    if (!this.isProcessingQueue) {
      this.processQueue();
    }

    return new Promise((resolve, reject) => {
      operation.callback = resolve;
      operation.errorCallback = reject;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.operationQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift()!;

      try {
        let result;

        switch (operation.type) {
          case 'save':
            result = await this.performSave(
              operation.data.id,
              operation.data.content,
              operation.data.options
            );
            break;
          case 'load':
            result = await this.performLoad(operation.data.id);
            break;
          case 'delete':
            result = await this.performDelete(operation.data.id);
            break;
          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }

        operation.callback?.(result);
      } catch (error) {
        console.error(`Background operation ${operation.id} failed:`, error);

        if (operation.retryCount < this.config.maxRetries) {
          operation.retryCount++;
          setTimeout(() => {
            this.operationQueue.unshift(operation);
          }, this.config.retryDelay * operation.retryCount);
        } else {
          operation.errorCallback?.(error instanceof Error ? error : new Error('Operation failed'));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // Cache management
  private updateCache(key: string, data: any): void {
    const size = JSON.stringify(data).length;
    
    // Remove old entry if exists
    const existing = this.cache.get(key);
    if (existing) {
      this.cacheSize -= existing.size;
    }

    // Add new entry
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      accessCount: 1,
      size
    };

    this.cache.set(key, entry);
    this.cacheSize += size;

    // Evict old entries if cache is full
    this.evictCache();
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.cacheTTL) {
      this.cache.delete(key);
      this.cacheSize -= entry.size;
      return null;
    }

    entry.accessCount++;
    entry.timestamp = Date.now();
    return entry.data;
  }

  private evictCache(): void {
    while (this.cache.size > this.config.maxCacheSize) {
      // Find least recently used entry
      let lruKey = '';
      let lruTimestamp = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.timestamp < lruTimestamp) {
          lruTimestamp = entry.timestamp;
          lruKey = key;
        }
      }

      if (lruKey) {
        const entry = this.cache.get(lruKey)!;
        this.cache.delete(lruKey);
        this.cacheSize -= entry.size;
      } else {
        break;
      }
    }
  }

  // Delete operation
  private async performDelete(id: string): Promise<boolean> {
    const operationId = this.performanceService.startOperation('performDelete');

    try {
      if (!this.db) {
        throw new Error('Database not initialized');
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(['documents'], 'readwrite');
        const store = transaction.objectStore('documents');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Remove from cache
      if (this.cache.has(id)) {
        const entry = this.cache.get(id)!;
        this.cache.delete(id);
        this.cacheSize -= entry.size;
      }

      return true;
    } finally {
      this.performanceService.endOperation(operationId, 'performDelete');
    }
  }

  // Get storage statistics
  getStorageStats(): {
    cacheSize: number;
    cacheEntries: number;
    queueLength: number;
    compressionEnabled: boolean;
    averageSaveTime: number;
  } {
    return {
      cacheSize: this.cacheSize,
      cacheEntries: this.cache.size,
      queueLength: this.operationQueue.length,
      compressionEnabled: this.config.enableCompression,
      averageSaveTime: 0 // Would need to track this
    };
  }

  // Cleanup resources
  cleanup(): void {
    console.log('🧹 Cleaning up storage service');
    
    this.operationQueue = [];
    this.cache.clear();
    this.cacheSize = 0;
    this.isProcessingQueue = false;

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default OptimizedStorageService;