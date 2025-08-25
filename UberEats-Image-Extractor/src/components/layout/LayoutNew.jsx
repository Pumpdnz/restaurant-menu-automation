import React from 'react';
import { Outlet } from 'react-router-dom';
import NavigationWrapper from '../Navigation';
import { Toaster } from '../ui/toaster';

export default function LayoutNew() {
  return (
    <NavigationWrapper>
      <Outlet />
      <Toaster />
    </NavigationWrapper>
  );
}