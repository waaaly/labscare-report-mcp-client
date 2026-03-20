'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database } from 'lucide-react';

export default function LimsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">LIMS Integration</h1>
        <p className="text-muted-foreground">
          Connect and query your LIMS system for sample data
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Database className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">LIMS Data Integration</h3>
          <p className="text-muted-foreground text-center">
            Query and retrieve sample data from your LIMS system
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
