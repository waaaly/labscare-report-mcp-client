'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCode } from 'lucide-react';

export default function ScriptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scripts</h1>
        <p className="text-muted-foreground">
          Manage your generated extraction scripts
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Script Management</h3>
          <p className="text-muted-foreground text-center">
            View, edit, and manage your extraction scripts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
