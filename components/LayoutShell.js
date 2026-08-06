'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutShell({ children }) {
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      setIsSidebarCollapsed(true);
    }
  }, []);

  // Login page should not render the sidebar layout shell
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next ? 'true' : 'false');
      return next;
    });
  };

  return (
    <div className={`shell ${isSidebarCollapsed && mounted ? 'shell-collapsed' : ''}`}>
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
      
      {isSidebarCollapsed && mounted && (
        <button 
          onClick={toggleSidebar}
          className="sidebar-floating-toggle animate-fade-in"
          aria-label="Show Sidebar"
          title="Show Sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      )}
      
      <main style={{ padding: isSidebarCollapsed && mounted ? '34px 44px 60px 80px' : '34px 44px 60px', transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {children}
      </main>
    </div>
  );
}
