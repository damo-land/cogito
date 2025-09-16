/**
 * Keyboard shortcut help overlay component
 * Shows searchable list of available keyboard shortcuts
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { KeyboardShortcut } from '../../services/keyboard/DefaultShortcuts';
import { keysToDisplayString } from '../../services/keyboard/ShortcutUtils';

interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface GroupedShortcuts {
  formatting: KeyboardShortcut[];
  editing: KeyboardShortcut[];
  navigation: KeyboardShortcut[];
}

const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ isOpen, onClose, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { shortcuts, shortcutsByCategory } = useKeyboardShortcuts();

  // Group shortcuts by category
  const groupedShortcuts = useMemo((): GroupedShortcuts => {
    return {
      formatting: shortcutsByCategory('formatting').filter(s => s.enabled),
      editing: shortcutsByCategory('editing').filter(s => s.enabled),
      navigation: shortcutsByCategory('navigation').filter(s => s.enabled),
    };
  }, [shortcutsByCategory]);

  // Filter shortcuts based on search term
  const filteredShortcuts = useMemo(() => {
    if (!searchTerm.trim()) return groupedShortcuts;

    const filterGroup = (shortcuts: KeyboardShortcut[]) => 
      shortcuts.filter(shortcut =>
        shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shortcut.command.toLowerCase().includes(searchTerm.toLowerCase()) ||
        keysToDisplayString(shortcut.keys).toLowerCase().includes(searchTerm.toLowerCase())
      );

    return {
      formatting: filterGroup(groupedShortcuts.formatting),
      editing: filterGroup(groupedShortcuts.editing),
      navigation: filterGroup(groupedShortcuts.navigation),
    };
  }, [groupedShortcuts, searchTerm]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderShortcutGroup = (title: string, shortcuts: KeyboardShortcut[]) => {
    if (shortcuts.length === 0) return null;

    return (
      <div className="shortcut-group" key={title}>
        <h3 className="shortcut-group-title">{title}</h3>
        <div className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.id} className="shortcut-item">
              <div className="shortcut-description">{shortcut.description}</div>
              <div className="shortcut-keys">
                {keysToDisplayString(shortcut.keys)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalShortcuts = Object.values(filteredShortcuts).flat().length;

  return (
    <div className={`shortcut-help-overlay ${className}`}>
      <div className="shortcut-help-backdrop" onClick={onClose} />
      <div className="shortcut-help-modal">
        <div className="shortcut-help-header">
          <h2 className="shortcut-help-title">Keyboard Shortcuts</h2>
          <button
            className="shortcut-help-close"
            onClick={onClose}
            aria-label="Close shortcuts help"
          >
            ✕
          </button>
        </div>

        <div className="shortcut-help-search">
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="shortcut-search-input"
            autoFocus
          />
        </div>

        <div className="shortcut-help-content">
          {totalShortcuts === 0 ? (
            <div className="shortcut-no-results">
              No shortcuts found matching "{searchTerm}"
            </div>
          ) : (
            <div className="shortcut-groups">
              {renderShortcutGroup('Text Formatting', filteredShortcuts.formatting)}
              {renderShortcutGroup('Editing', filteredShortcuts.editing)}
              {renderShortcutGroup('Navigation', filteredShortcuts.navigation)}
            </div>
          )}
        </div>

        <div className="shortcut-help-footer">
          <p className="shortcut-help-tip">
            Press <strong>Esc</strong> to close this dialog
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelp;