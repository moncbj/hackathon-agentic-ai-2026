'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner, Skeleton } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Alert } from '@/components/ui/alert';

export function PreviewClient() {
  const [retryMessage, setRetryMessage] = useState('');

  return (
    <div className="space-y-12 pb-24">
      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Buttons</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Primary</div>
            <div className="flex gap-2 items-center">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="md">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Secondary</div>
            <div className="flex gap-2 items-center">
              <Button variant="secondary" size="md">Medium</Button>
              <Button variant="secondary" disabled>Disabled</Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Danger</div>
            <div className="flex gap-2 items-center">
              <Button variant="danger" size="md">Medium</Button>
              <Button variant="danger" disabled>Disabled</Button>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-slate-500">Ghost</div>
            <div className="flex gap-2 items-center">
              <Button variant="ghost" size="md">Medium</Button>
              <Button variant="ghost" disabled>Disabled</Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Badges (Skill Status)</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="w-32 text-sm text-slate-500">Default</div>
            <Badge status="locked" />
            <Badge status="available" />
            <Badge status="in_progress" />
            <Badge status="acquired" />
            <Badge status="struggling" />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="w-32 text-sm text-slate-500">Self Reported</div>
            <Badge status="locked" verification="self_reported" />
            <Badge status="available" verification="self_reported" />
            <Badge status="in_progress" verification="self_reported" />
            <Badge status="acquired" verification="self_reported" />
            <Badge status="struggling" verification="self_reported" />
          </div>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="w-32 text-sm text-slate-500">Verified</div>
            <Badge status="locked" verification="verified" />
            <Badge status="available" verification="verified" />
            <Badge status="in_progress" verification="verified" />
            <Badge status="acquired" verification="verified" />
            <Badge status="struggling" verification="verified" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Spinners & Skeletons</h2>
        <div className="flex flex-wrap gap-8 items-end">
          <div className="space-y-2 text-center">
            <div className="text-sm text-slate-500">Small</div>
            <Spinner size="sm" />
          </div>
          <div className="space-y-2 text-center">
            <div className="text-sm text-slate-500">Medium</div>
            <Spinner size="md" />
          </div>
          <div className="space-y-2 text-center">
            <div className="text-sm text-slate-500">Large</div>
            <Spinner size="lg" />
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <div className="text-sm text-slate-500">Skeleton</div>
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">This is a standard card with header, content, and footer.</p>
            </CardContent>
            <CardFooter>
              <Button variant="primary">Action</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-600">This is a simple card with only content. Useful for basic grouping.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Empty State</h2>
        <EmptyState />
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Error State</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ErrorState />
          <div className="flex flex-col items-center gap-2">
            <ErrorState onRetry={() => setRetryMessage('Retry button was clicked!')} />
            {retryMessage && <div className="text-sm text-emerald-600 font-medium">{retryMessage}</div>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6 border-b pb-2">Alerts</h2>
        <div className="space-y-4">
          <Alert variant="info" title="Information">
            This is an informative alert that tells you something useful.
          </Alert>
          <Alert variant="warning" title="Warning">
            This is a warning alert. You should probably pay attention.
          </Alert>
          <Alert variant="success" title="Success">
            This is a success alert. Everything went perfectly!
          </Alert>
          <Alert variant="error" title="Error">
            This is an error alert. Something went terribly wrong.
          </Alert>
        </div>
      </div>
    </div>
  );
}
