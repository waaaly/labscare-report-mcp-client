'use client';

import { useState, useEffect } from 'react';
import { useLabStore } from '@/store/lab-store';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlaskConical, Plus, Search } from 'lucide-react';
import { Lab } from '@/types';

export default function LabSwitcher() {
  const { currentLab, labs, switchLab, setLabs, isLoading } = useLabStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [labName, setLabName] = useState('');
  const [labDomain, setLabDomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchLabs();
  }, []);

  const fetchLabs = async () => {
    try {
      const response = await fetch('/api/labs');
      if (response.ok) {
        const data = await response.json();
        setLabs(data);
        if (!currentLab && data.length > 0) {
          switchLab(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch labs:', error);
    }
  };

  const handleLabChange = (labId: string) => {
    switchLab(labId);
  };

  const handleCreateLab = async () => {
    if (!labName.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/labs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: labName,
          domain: labDomain || undefined,
        }),
      });

      if (response.ok) {
        const newLab = await response.json();
        setLabs([...labs, newLab]);
        switchLab(newLab.id);
        setIsDialogOpen(false);
        setLabName('');
        setLabDomain('');
      } else {
        console.error('Failed to create lab');
      }
    } catch (error) {
      console.error('Failed to create lab:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredLabs = labs.filter((lab) =>
    lab.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <Select
          value={currentLab?.id || ''}
          onValueChange={handleLabChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a lab...">
              {currentLab ? (
                <div className="flex items-center gap-2">
                  <span>{currentLab.name}</span>
                  <span className="text-xs text-muted-foreground">
                    v{currentLab.version}
                  </span>
                </div>
              ) : (
                'Select a lab...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {filteredLabs.map((lab) => (
              <SelectItem key={lab.id} value={lab.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{lab.name}</span>
                  <span className="text-xs text-muted-foreground">
                    v{lab.version}
                  </span>
                </div>
              </SelectItem>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Lab
            </Button>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Lab</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lab Name</label>
              <Input 
                placeholder="Enter lab name..." 
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Domain (Optional)</label>
              <Input 
                placeholder="e.g., clinical, research, testing" 
                value={labDomain}
                onChange={(e) => setLabDomain(e.target.value)}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateLab}
              disabled={isCreating || !labName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create Lab'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
