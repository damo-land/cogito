import React, { useState, useEffect, useCallback, memo } from 'react';
import Editor from '../components/editor/Editor';
import PerformanceMonitor from '../utils/performance';
import { OptimizedStorageService } from '../services/storage/OptimizedStorageService';

const NewTab: React.FC = memo(() => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasConflicts, setHasConflicts] = useState(false);
  const [initialContent, setInitialContent] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [currentContent, setCurrentContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState('');
  const [storageService] = useState(() => OptimizedStorageService.getInstance());

  useEffect(() => {
    const initializeApp = async () => {
      try {
        PerformanceMonitor.markStart('component_initialization');
        
        // Initialize storage service first, then load content and theme
        try {
          // Wait for storage service to be fully ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Load saved content
          const savedDocument = await storageService.load('current-document', {
            useCache: true,
            background: false
          });
          if (savedDocument?.content) {
            setInitialContent(savedDocument.content);
            setCurrentContent(savedDocument.content);
            console.log('📂 Loaded saved content:', savedDocument.content.length, 'characters');
          }

          // Load dark mode preference
          const savedTheme = await storageService.load('theme-preference', {
            useCache: true,
            background: false
          });
          if (savedTheme?.content === 'dark') {
            setIsDarkMode(true);
          }

          // Load background preference
          const savedBackground = await storageService.load('show-background', {
            useCache: true,
            background: false
          });
          if (savedBackground?.content === 'true') {
            setShowBackground(true);
          }

          loadRandomImage();
        } catch (error) {
          console.warn('Could not load saved content:', error);
          // Try again after a delay in case database is still initializing
          setTimeout(async () => {
            try {
              const savedDocument = await storageService.load('current-document', {
                useCache: true,
                background: false
              });
              if (savedDocument?.content) {
                setInitialContent(savedDocument.content);
                console.log('✅ Content loaded on retry');
              }
            } catch (retryError) {
              console.warn('Retry also failed:', retryError);
            }
          }, 500);
        }
        
        // Check for extension conflicts (non-blocking)
        checkForConflicts().catch(err => 
          console.warn('Conflict detection failed:', err)
        );
        
        // Optimize initial render
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        PerformanceMonitor.markEnd('component_initialization');
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize new tab app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [storageService]);

  // Load single full-resolution image at startup
  const loadRandomImage = useCallback(() => {
    try {
      // Get browser dimensions
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Always load full-resolution image suitable for full-screen display
      const bgWidth = Math.floor(windowWidth * devicePixelRatio);
      const bgHeight = Math.floor(windowHeight * devicePixelRatio);
      
      const randomSeed = Date.now() + Math.floor(Math.random() * 1000);
      
      // Use Picsum with full window dimensions
      const imageUrl = `https://picsum.photos/${bgWidth}/${bgHeight}?random=${randomSeed}`;
      setBackgroundImageUrl(imageUrl);
      
      // Loading background image
    } catch (error) {
      console.warn('Failed to load random image:', error);
      // Fallback to standard full-screen size
      setBackgroundImageUrl(`https://picsum.photos/1920/1080?random=${Math.floor(Math.random() * 1000)}`);
    }
  }, []);


  const checkForConflicts = async (): Promise<void> => {
    try {
      // Check if other extensions might be overriding the new tab page
      if (chrome.management) {
        const extensions = await chrome.management.getAll();
        const newTabExtensions = extensions.filter(ext => 
          ext.enabled && 
          ext.id !== chrome.runtime.id &&
          ext.permissions && 
          ext.permissions.some(perm => perm.includes('newtab') || perm.includes('chrome://newtab'))
        );
        
        if (newTabExtensions.length > 0) {
          setHasConflicts(true);
          console.warn('Detected potential new tab extension conflicts');
        }
      }
    } catch (error) {
      console.warn('Could not check for extension conflicts:', error);
    }
  };

  const handleConflictDismiss = useCallback(() => {
    setHasConflicts(false);
  }, []);

  const toggleDarkMode = useCallback(async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    try {
      await storageService.save('theme-preference', newMode ? 'dark' : 'light', {
        background: false,
        priority: 'low'
      });
    } catch (error) {
      console.warn('Failed to save theme preference:', error);
    }
  }, [isDarkMode, storageService]);

  const toggleBackground = useCallback(async () => {
    const newState = !showBackground;
    setShowBackground(newState);
    
    try {
      await storageService.save('show-background', newState ? 'true' : 'false', {
        background: false,
        priority: 'low'
      });
    } catch (error) {
      console.warn('Failed to save background preference:', error);
    }
  }, [showBackground, storageService]);

  const downloadMarkdown = useCallback(() => {
    if (!currentContent.trim()) return;
    
    const blob = new Blob([currentContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentContent]);

  if (isLoading) {
    return (null);
  }

  return (
    <>
      {hasConflicts && (
        <div className="conflict-banner">
          <div className="conflict-content">
            <span className="conflict-icon">⚠️</span>
            <div className="conflict-text">
              <strong>Extension Conflict Detected</strong>
              <p>Other new tab extensions may interfere with this editor.</p>
            </div>
            <button onClick={handleConflictDismiss} className="conflict-dismiss">
              ×
            </button>
          </div>
        </div>
      )}
      
      <div style={{ 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        transition: 'background-color 0.3s ease',
        position: 'relative'
      }}>
        {/* Background Image - Always visible and clickable */}
        <div style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: showBackground ? '100%' : '24%',
          height: '100vh',
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: showBackground ? 10 : 1,
          transition: 'width 0.5s ease, opacity 0.3s ease',
          opacity: showBackground ? (isDarkMode ? 0.9 : 0.95) : (isDarkMode ? 0.7 : 0.8),
          cursor: 'pointer'
        }} 
        onClick={() => {
          setShowBackground(!showBackground);
        }}
        />
        
        {/* Editor Container */}
        <div style={{
          width: showBackground ? '100%' : '76%',
          height: '100vh',
          position: 'relative',
          zIndex: 2,
          transition: 'width 0.5s ease, opacity 0.5s ease',
          opacity: showBackground ? 0 : 1,
          pointerEvents: showBackground ? 'none' : 'auto'
        }}>
          <Editor
            initialContent={initialContent}
            placeholder=""
            showToolbar={false}
            showStatus={false}
            isDarkMode={isDarkMode}
            onContentChange={(content, wordCount) => {
              setCurrentContent(content);
              // Content changed - silently update
            }}
            onSave={async (content) => {
              if (isSaving) {
                console.log('🔄 Save already in progress, skipping...');
                return;
              }
              
              try {
                setIsSaving(true);
                setCurrentContent(content);
                console.log('💾 Saving content...');
                const result = await storageService.save('current-document', content, {
                  compress: false, // Disable compression for now to fix hanging issue
                  background: false,
                  priority: 'high'
                });
                console.log('✅ Content saved successfully');
              } catch (error) {
                console.error('❌ Failed to save content:', error);
              } finally {
                setIsSaving(false);
              }
            }}
            autoSaveDelay={2000}
          />
        </div>
        
        {/* Controls */}
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: showBackground ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#6b7280'),
          zIndex: 1000,
          backgroundColor: showBackground ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
          padding: showBackground ? '8px 12px' : '0',
          borderRadius: showBackground ? '8px' : '0',
          backdropFilter: showBackground ? 'blur(10px)' : 'none',
          transition: 'all 0.3s ease'
        }}>
          {/* Download button */}
          <button
            onClick={downloadMarkdown}
            style={{
              background: 'none',
              border: 'none',
              cursor: currentContent.trim() ? 'pointer' : 'not-allowed',
              color: currentContent.trim() ? 
                (showBackground ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#6b7280')) : 
                (showBackground ? 'rgba(255, 255, 255, 0.5)' : (isDarkMode ? '#4b5563' : '#d1d5db')),
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.3s ease',
              outline: 'none'
            }}
            aria-label="Download markdown file"
            disabled={!currentContent.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          {/* Background toggle */}
          <button
            onClick={toggleBackground}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: showBackground ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#6b7280'),
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.3s ease',
              outline: 'none'
            }}
            aria-label="Toggle background image"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21,15 16,10 5,21"/>
            </svg>
          </button>
          
          {/* Dark mode toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: showBackground ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#6b7280') }}>
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <button
              onClick={toggleDarkMode}
              style={{
                width: '40px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: isDarkMode ? '#f59e0b' : '#d1d5db',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.3s ease',
                outline: 'none'
              }}
              aria-label="Toggle dark mode"
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                position: 'absolute',
                top: '2px',
                left: isDarkMode ? '22px' : '2px',
                transition: 'left 0.3s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
              }} />
            </button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: showBackground ? '#ffffff' : (isDarkMode ? '#d1d5db' : '#6b7280') }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>
        </div>
      </div>
    </>
  );
});

NewTab.displayName = 'NewTab';

export default NewTab;