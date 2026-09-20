import React from 'react';
import { notFound } from 'next/navigation';
import { PreviewClient } from './preview-client';

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <PreviewClient />;
}
