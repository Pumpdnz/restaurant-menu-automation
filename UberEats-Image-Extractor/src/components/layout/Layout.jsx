import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { Toaster } from '../ui/toaster';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex">
        <Sidebar sidebarOpen={sidebarOpen} />
        
        {/* Main content - responsive padding and width */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}