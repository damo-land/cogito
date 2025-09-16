import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h2 className="app-title">Markdown Editor</h2>
        </div>
        <div className="header-right">
          <div className="header-status">
            <span className="status-indicator online"></span>
            <span className="status-text">Local</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;