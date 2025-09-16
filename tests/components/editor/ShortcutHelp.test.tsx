/**
 * Tests for ShortcutHelp component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShortcutHelp from '../../../src/components/editor/ShortcutHelp';

// Mock the keyboard shortcuts hook
const mockShortcuts = {
  toggleBold: {
    id: 'toggleBold',
    keys: ['Ctrl', 'b'],
    command: 'toggleBold',
    description: 'Toggle bold formatting',
    category: 'formatting' as const,
    enabled: true,
    isDefault: true,
  },
  toggleItalic: {
    id: 'toggleItalic',
    keys: ['Ctrl', 'i'],
    command: 'toggleItalic',
    description: 'Toggle italic formatting',
    category: 'formatting' as const,
    enabled: true,
    isDefault: true,
  },
  heading1: {
    id: 'heading1',
    keys: ['Ctrl', 'Shift', '1'],
    command: 'setHeading1',
    description: 'Set heading level 1',
    category: 'formatting' as const,
    enabled: true,
    isDefault: true,
  },
  undo: {
    id: 'undo',
    keys: ['Ctrl', 'z'],
    command: 'undo',
    description: 'Undo last action',
    category: 'editing' as const,
    enabled: true,
    isDefault: true,
  },
  showHelp: {
    id: 'showHelp',
    keys: ['Ctrl', '/'],
    command: 'showHelp',
    description: 'Show keyboard shortcuts help',
    category: 'navigation' as const,
    enabled: true,
    isDefault: true,
  },
};

const mockShortcutsByCategory = vi.fn((category: string) => {
  return Object.values(mockShortcuts).filter(s => s.category === category);
});

vi.mock('../../../src/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => ({
    shortcuts: mockShortcuts,
    shortcutsByCategory: mockShortcutsByCategory,
  }),
}));

// Mock the shortcut utils
vi.mock('../../../src/services/keyboard/ShortcutUtils', () => ({
  keysToDisplayString: (keys: string[]) => keys.join('+'),
}));

describe('ShortcutHelp', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<ShortcutHelp isOpen={false} onClose={mockOnClose} />);
    
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
  });

  it('should display shortcuts grouped by category', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    // Check for category headers
    expect(screen.getByText('Text Formatting')).toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
    
    // Check for specific shortcuts
    expect(screen.getByText('Toggle bold formatting')).toBeInTheDocument();
    expect(screen.getByText('Toggle italic formatting')).toBeInTheDocument();
    expect(screen.getByText('Undo last action')).toBeInTheDocument();
  });

  it('should display keyboard shortcut keys', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Ctrl+b')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+i')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+Shift+1')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+z')).toBeInTheDocument();
  });

  it('should filter shortcuts based on search term', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    
    // Search for "bold"
    await user.type(searchInput, 'bold');
    
    await waitFor(() => {
      expect(screen.getByText('Toggle bold formatting')).toBeInTheDocument();
      expect(screen.queryByText('Toggle italic formatting')).not.toBeInTheDocument();
    });
  });

  it('should show no results message when search yields no matches', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    
    // Search for something that doesn't exist
    await user.type(searchInput, 'nonexistent');
    
    await waitFor(() => {
      expect(screen.getByText('No shortcuts found matching "nonexistent"')).toBeInTheDocument();
    });
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const closeButton = screen.getByRole('button', { name: 'Close shortcuts help' });
    await user.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when backdrop is clicked', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const backdrop = document.querySelector('.shortcut-help-backdrop');
    expect(backdrop).toBeInTheDocument();
    
    await user.click(backdrop as Element);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should close modal when Escape key is pressed', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should focus search input when modal opens', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    expect(searchInput).toHaveFocus();
  });

  it('should reset search when modal reopens', () => {
    const { rerender } = render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    fireEvent.change(searchInput, { target: { value: 'test search' } });
    
    expect(searchInput).toHaveValue('test search');
    
    // Close and reopen
    rerender(<ShortcutHelp isOpen={false} onClose={mockOnClose} />);
    rerender(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const newSearchInput = screen.getByPlaceholderText('Search shortcuts...');
    expect(newSearchInput).toHaveValue('');
  });

  it('should filter by command name', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    
    // Search for command name
    await user.type(searchInput, 'undo');
    
    await waitFor(() => {
      expect(screen.getByText('Undo last action')).toBeInTheDocument();
      expect(screen.queryByText('Toggle bold formatting')).not.toBeInTheDocument();
    });
  });

  it('should filter by key combination', async () => {
    const user = userEvent.setup();
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    const searchInput = screen.getByPlaceholderText('Search shortcuts...');
    
    // Search for key combination
    await user.type(searchInput, 'ctrl+b');
    
    await waitFor(() => {
      expect(screen.getByText('Toggle bold formatting')).toBeInTheDocument();
      expect(screen.queryByText('Toggle italic formatting')).not.toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    const customClass = 'custom-help-class';
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} className={customClass} />);
    
    const overlay = document.querySelector('.shortcut-help-overlay');
    expect(overlay).toHaveClass(customClass);
  });

  it('should not show empty categories', () => {
    // Mock shortcutsByCategory to return empty array for formatting
    mockShortcutsByCategory.mockImplementation((category: string) => {
      if (category === 'formatting') return [];
      return Object.values(mockShortcuts).filter(s => s.category === category);
    });
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.queryByText('Text Formatting')).not.toBeInTheDocument();
    expect(screen.getByText('Editing')).toBeInTheDocument();
    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('should handle disabled shortcuts correctly', () => {
    // Mock shortcuts with some disabled
    const mockShortcutsWithDisabled = {
      ...mockShortcuts,
      toggleBold: { ...mockShortcuts.toggleBold, enabled: false },
    };

    mockShortcutsByCategory.mockImplementation((category: string) => {
      return Object.values(mockShortcutsWithDisabled)
        .filter(s => s.category === category && s.enabled);
    });
    
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    // Disabled shortcuts should not appear
    expect(screen.queryByText('Toggle bold formatting')).not.toBeInTheDocument();
    expect(screen.getByText('Toggle italic formatting')).toBeInTheDocument();
  });

  it('should display footer with escape key tip', () => {
    render(<ShortcutHelp isOpen={true} onClose={mockOnClose} />);
    
    // Test the footer element specifically
    const footer = document.querySelector('.shortcut-help-tip');
    expect(footer).toBeInTheDocument();
    expect(footer?.textContent).toBe('Press Esc to close this dialog');
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });
});