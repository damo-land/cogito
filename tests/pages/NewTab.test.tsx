import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import NewTab from '../../src/pages/NewTab';

// Mock Chrome APIs
const mockChrome = {
  management: {
    getAll: vi.fn()
  },
  runtime: {
    id: 'test-extension-id'
  }
};

(global as any).chrome = mockChrome;

// Mock performance monitoring
vi.mock('../../src/utils/performance', () => ({
  default: {
    markStart: vi.fn(),
    markEnd: vi.fn(() => 50), // Return fast initialization time
    reportMetrics: vi.fn(),
    checkMemoryUsage: vi.fn()
  }
}));

describe('NewTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.management.getAll.mockResolvedValue([]);
  });

  test('renders loading state initially', () => {
    render(<NewTab />);
    expect(screen.getByText('Loading WYSIWYG Markdown Editor...')).toBeInTheDocument();
  });

  test('renders main interface after loading', async () => {
    render(<NewTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to WYSIWYG Markdown Editor')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Start writing immediately - your content will be saved automatically.')).toBeInTheDocument();
  });

  test('displays editor interface', async () => {
    render(<NewTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to WYSIWYG Markdown Editor')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Start writing immediately - your content will be saved automatically.')).toBeInTheDocument();
    expect(document.querySelector('.prosemirror-editor')).toBeInTheDocument();
  });

  test('handles extension conflict detection', async () => {
    const conflictingExtension = {
      id: 'other-extension',
      enabled: true,
      permissions: ['chrome://newtab']
    };
    
    mockChrome.management.getAll.mockResolvedValue([conflictingExtension]);
    
    render(<NewTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Extension Conflict Detected')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Other new tab extensions may interfere with this editor.')).toBeInTheDocument();
  });

  test('initializes within performance target', async () => {
    const performanceMock = await import('../../src/utils/performance');
    
    render(<NewTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to WYSIWYG Markdown Editor')).toBeInTheDocument();
    });
    
    expect(performanceMock.default.markStart).toHaveBeenCalledWith('component_initialization');
    expect(performanceMock.default.markEnd).toHaveBeenCalledWith('component_initialization');
  });

  test('handles chrome API errors gracefully', async () => {
    mockChrome.management.getAll.mockRejectedValue(new Error('API not available'));
    
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(<NewTab />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to WYSIWYG Markdown Editor')).toBeInTheDocument();
    });
    
    expect(consoleSpy).toHaveBeenCalledWith(
      'Could not check for extension conflicts:', 
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});