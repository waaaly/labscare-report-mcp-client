'use client';

import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Plus, Mail, Shield } from 'lucide-react';

export default function MembersPage() {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">
            Manage team members and permissions for {currentLab.name}
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
                  A
                </div>
                <div>
                  <div className="font-medium">Admin User</div>
                  <div className="text-sm text-muted-foreground">admin@example.com</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Owner</span>
              </div>
            </div>

            <div className="text-center py-8 text-muted-foreground">
              No other members yet. Invite team members to collaborate on this lab.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
