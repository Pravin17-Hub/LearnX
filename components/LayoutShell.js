'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function LayoutShell({ children }) {
  const pathname = usePathname();
  
  // Login page should not render the sidebar layout shell
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <Sidebar />
      <main style={{ padding: '34px 44px 60px' }}>
        {children}
      </main>
    </div>
  );
}
