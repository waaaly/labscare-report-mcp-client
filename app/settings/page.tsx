'use client';

import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const { currentLab } = useLabStore();

  if (!currentLab) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Please select a lab first</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure {currentLab.name} settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lab Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lab Name</label>
              <Input defaultValue={currentLab.name} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Domain</label>
              <Input defaultValue={currentLab.domain || ''} placeholder="e.g., clinical, research" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Version</label>
              <Input defaultValue={currentLab.version} />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Knowledge Base</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage your lab's knowledge base including field mappings, extraction rules,
              and prompt templates.
            </p>
            <Button variant="outline" className="w-full">
              Go to Knowledge Center
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
