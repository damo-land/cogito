export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface DecompressionResult {
  decompressed: string;
  originalSize: number;
}

export class CompressionService {
  private static instance: CompressionService;

  private constructor() {}

  static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  // Simple LZ-based compression for text content
  async compress(input: string): Promise<CompressionResult> {
    if (!input || input.length === 0) {
      return {
        compressed: '',
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 1
      };
    }

    const originalSize = new Blob([input]).size;

    try {
      // Use built-in compression if available (modern browsers)
      if (typeof CompressionStream !== 'undefined') {
        return await this.compressWithCompressionStream(input);
      } else {
        // Fallback to simple dictionary-based compression
        return this.compressWithDictionary(input);
      }
    } catch (error) {
      console.warn('Compression failed, returning original:', error);
      return {
        compressed: input,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1
      };
    }
  }

  // Decompress compressed content
  async decompress(compressed: string, metadata?: { method: string }): Promise<DecompressionResult> {
    if (!compressed) {
      return {
        decompressed: '',
        originalSize: 0
      };
    }

    try {
      if (compressed.startsWith('DICT:')) {
        return this.decompressWithDictionary(compressed);
      } else if (compressed.startsWith('GZIP:')) {
        return await this.decompressWithCompressionStream(compressed);
      } else {
        // Assume uncompressed
        return {
          decompressed: compressed,
          originalSize: new Blob([compressed]).size
        };
      }
    } catch (error) {
      console.warn('Decompression failed, returning original:', error);
      return {
        decompressed: compressed,
        originalSize: new Blob([compressed]).size
      };
    }
  }

  // Modern compression using CompressionStream (Chrome 80+)
  private async compressWithCompressionStream(input: string): Promise<CompressionResult> {
    const originalSize = new Blob([input]).size;
    
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write input to compression stream
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(input);
    await writer.write(inputBytes);
    await writer.close();

    // Read compressed result
    const chunks: Uint8Array[] = [];
    let result;
    while (!(result = await reader.read()).done) {
      chunks.push(result.value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64 string with prefix
    const compressedString = 'GZIP:' + btoa(String.fromCharCode(...compressed));
    const compressedSize = new Blob([compressedString]).size;

    return {
      compressed: compressedString,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize
    };
  }

  // Fallback compression using dictionary approach
  private compressWithDictionary(input: string): CompressionResult {
    const originalSize = new Blob([input]).size;

    // Build frequency map for common substrings
    const substringMap = new Map<string, number>();
    const minSubstringLength = 4;
    const maxSubstringLength = 20;

    // Find common substrings
    for (let len = minSubstringLength; len <= Math.min(maxSubstringLength, input.length); len++) {
      for (let i = 0; i <= input.length - len; i++) {
        const substring = input.substr(i, len);
        substringMap.set(substring, (substringMap.get(substring) || 0) + 1);
      }
    }

    // Select most frequent substrings for dictionary
    const dictionary = Array.from(substringMap.entries())
      .filter(([substr, count]) => count >= 3) // Only keep substrings that appear 3+ times
      .sort((a, b) => (b[1] * b[0].length) - (a[1] * a[0].length)) // Sort by savings potential
      .slice(0, 256) // Limit dictionary size
      .map(([substr]) => substr);

    // Create compressed representation
    let compressed = input;
    const replacements: Array<{ original: string; replacement: string }> = [];

    dictionary.forEach((substr, index) => {
      const replacement = String.fromCharCode(256 + index); // Use high unicode values
      const regex = new RegExp(this.escapeRegex(substr), 'g');
      const matches = compressed.match(regex);
      
      if (matches && matches.length >= 2) { // Only replace if it saves space
        compressed = compressed.replace(regex, replacement);
        replacements.push({ original: substr, replacement });
      }
    });

    // Create dictionary header
    const dictHeader = JSON.stringify(replacements);
    const finalCompressed = `DICT:${dictHeader.length}:${dictHeader}${compressed}`;
    const compressedSize = new Blob([finalCompressed]).size;

    return {
      compressed: finalCompressed,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize
    };
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Decompress modern compression
  private async decompressWithCompressionStream(compressed: string): Promise<DecompressionResult> {
    const compressedData = compressed.substring(5); // Remove 'GZIP:' prefix
    
    // Decode from base64
    const binaryString = atob(compressedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const stream = new DecompressionStream('gzip');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write compressed data
    await writer.write(bytes);
    await writer.close();

    // Read decompressed result
    const chunks: Uint8Array[] = [];
    let result;
    while (!(result = await reader.read()).done) {
      chunks.push(result.value);
    }

    // Combine chunks and decode
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const decompressed = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.length;
    }

    const decoder = new TextDecoder();
    const decompressedString = decoder.decode(decompressed);

    return {
      decompressed: decompressedString,
      originalSize: new Blob([decompressedString]).size
    };
  }

  // Decompress dictionary-based compression
  private decompressWithDictionary(compressed: string): DecompressionResult {
    const content = compressed.substring(5); // Remove 'DICT:' prefix
    
    // Parse dictionary header
    const colonIndex = content.indexOf(':');
    if (colonIndex === -1) {
      throw new Error('Invalid dictionary format');
    }

    const headerLength = parseInt(content.substring(0, colonIndex));
    const headerEnd = colonIndex + 1 + headerLength;
    const dictHeader = content.substring(colonIndex + 1, headerEnd);
    const compressedContent = content.substring(headerEnd);

    let replacements: Array<{ original: string; replacement: string }>;
    try {
      replacements = JSON.parse(dictHeader);
    } catch (error) {
      throw new Error('Failed to parse dictionary header');
    }

    // Apply reverse replacements
    let decompressed = compressedContent;
    replacements.forEach(({ original, replacement }) => {
      const regex = new RegExp(this.escapeRegex(replacement), 'g');
      decompressed = decompressed.replace(regex, original);
    });

    return {
      decompressed,
      originalSize: new Blob([decompressed]).size
    };
  }

  // Determine if content should be compressed
  shouldCompress(content: string, minSize: number = 1024): boolean {
    return content.length >= minSize;
  }

  // Get compression statistics for content
  getCompressionStats(content: string): {
    originalSize: number;
    shouldCompress: boolean;
    estimatedCompressedSize: number;
    estimatedSavings: number;
    compressionRatio: number;
  } {
    const originalSize = new Blob([content]).size;
    const shouldCompress = this.shouldCompress(content);

    if (!shouldCompress) {
      return {
        originalSize,
        shouldCompress: false,
        estimatedCompressedSize: originalSize,
        estimatedSavings: 0,
        compressionRatio: 1
      };
    }

    // Quick estimation based on content analysis
    const uniqueChars = new Set(content).size;
    const repetitionFactor = content.length / uniqueChars;
    const estimatedRatio = Math.max(0.3, Math.min(0.9, 1 - (repetitionFactor - 1) * 0.1));
    const estimatedCompressedSize = Math.floor(originalSize * estimatedRatio);
    const estimatedSavings = originalSize - estimatedCompressedSize;

    return {
      originalSize,
      shouldCompress: true,
      estimatedCompressedSize,
      estimatedSavings,
      compressionRatio: originalSize / estimatedCompressedSize
    };
  }
}

// Utility functions for easy compression/decompression
export const compressionService = CompressionService.getInstance();

export async function compressContent(content: string): Promise<CompressionResult> {
  return compressionService.compress(content);
}

export async function decompressContent(compressed: string): Promise<DecompressionResult> {
  return compressionService.decompress(compressed);
}

export function shouldCompressContent(content: string, minSize?: number): boolean {
  return compressionService.shouldCompress(content, minSize);
}

export default CompressionService;