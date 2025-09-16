import React from 'react';
import ReactDOM from 'react-dom/client';
import NewTab from './pages/NewTab';
import PerformanceMonitor from './utils/performance';
import './styles/main.css';

// Performance monitoring
PerformanceMonitor.markStart('app_initialization');

// Error boundary for Chrome extension context
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('NewTab React Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>The new tab page encountered an error. Please refresh or check the extension.</p>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Initialize React application
const container = document.getElementById('app');
if (!container) {
  throw new Error('Failed to find app container element');
}

const root = ReactDOM.createRoot(container);

try {
  
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <NewTab />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Report initialization time
  PerformanceMonitor.markEnd('app_initialization');
  console.log('✅ NewTab React app initialized');
  
} catch (error) {
  console.error('Failed to render NewTab app:', error);
  
  // Fallback content
  container.innerHTML = `
    <div class="fallback-error">
      <h2>Failed to load editor</h2>
      <p>Please refresh the tab or check your extension settings.</p>
    </div>
  `;
}