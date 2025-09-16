import React from 'react';
import Header from './Header';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="app-layout">
      <Header />
      <div className="app-content">
        {children}
      </div>
    </div>
  );
};

export default AppLayout;