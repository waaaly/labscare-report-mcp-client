'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLabStore } from '@/store/lab-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { FolderKanban, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const { currentLab } = useLabStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!projectId.trim()) {
      setError('Project ID is required');
      return;
    }

    if (!projectId.trim().startsWith('330')) {
      setError('Project ID must start with "330"');
      return;
    }

    if (!currentLab) {
      setError('No lab selected');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch(`/api/labs/${currentLab.id}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          limsPid: projectId.trim(),
          caseId: caseId.trim() || undefined,
        }),
      });

      if (response.ok) {
        const project = await response.json();
        router.push(`/projects/${project.id}`);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create project');
      }
    } catch (err) {
      setError('An error occurred while creating the project');
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentLab) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Lab Selected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Please select a lab to create a new project
            </p>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground">
            {currentLab.name} • Create a new data extraction project
          </p>
        </div>
        <Link href="/projects">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Enter the details for your new project. You can configure documents, schemas, and scripts after creation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Clinical Lab Reports 2024"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name for your project
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">
                Project ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectId"
                placeholder="e.g., 330001"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isCreating}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Project ID must start with &quot;330&quot;
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseId">Case ID</Label>
              <Input
                id="caseId"
                placeholder="e.g., CASE-2024-001"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                disabled={isCreating}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Associate this project with a case
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the purpose and scope of this project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
                rows={4}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Optional: Provide additional context about this project
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isCreating || !name.trim() || !projectId.trim()}
                className="flex-1 cursor-pointer"
              >
                <Save className="mr-2 h-4 w-4" />
                {isCreating ? 'Creating...' : 'Create Project'}
              </Button>
              <Link href="/projects" className="flex-1">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full cursor-pointer"
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s Next?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium">Upload Documents</p>
                <p className="text-muted-foreground">
                  Add laboratory reports and documents to extract data from
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium">Define Schemas</p>
                <p className="text-muted-foreground">
                  Create data schemas to structure the extracted information
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold">3</span>
              </div>
              <div>
                <p className="font-medium">Generate Scripts</p>
                <p className="text-muted-foreground">
                  Use AI to generate extraction scripts based on your schemas
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
