//@ts-nocheck
'use client';
import { useState } from 'react';
import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function KnowledgeCenterPage() {
  const { currentLab, updateLabFieldMappings, updateLabExtractionRules, updateLabSampleFilters, updateLabPromptTemplates } = useLabStore();

  const [fieldMappings, setFieldMappings] = useState<Record<string, unknown>>(currentLab?.fieldMappings || {});
  const [extractionRules, setExtractionRules] = useState<Record<string, unknown>>(currentLab?.extractionRules || {});
  const [sampleFilters, setSampleFilters] = useState<Record<string, unknown>>(currentLab?.sampleFilters || {});
  const [promptTemplates, setPromptTemplates] = useState<Record<string, unknown>>(currentLab?.promptTemplates || {});

  if (!currentLab) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Please select a lab first</div>
      </div>
    );
  }

  const handleSave = async (type: string) => {
    try {
      const response = await fetch(`/api/labs/${currentLab.id}/knowledge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          knowledgeBase: {
            fieldMappings,
            extractionRules,
            sampleFilters,
            promptTemplates,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save knowledge base');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Center</h1>
          <p className="text-muted-foreground">
            Manage {currentLab.name}'s knowledge base and extraction rules
          </p>
        </div>
      </div>

      <Tabs defaultValue="mappings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
          <TabsTrigger value="rules">Extraction Rules</TabsTrigger>
          <TabsTrigger value="filters">Sample Filters</TabsTrigger>
          <TabsTrigger value="templates">Prompt Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Field Mappings</CardTitle>
                <Button onClick={() => handleSave('mappings')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm h-96">
                {JSON.stringify(fieldMappings, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Extraction Rules</CardTitle>
                <Button onClick={() => handleSave('rules')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm h-96">
                {JSON.stringify(extractionRules, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sample Filters</CardTitle>
                <Button onClick={() => handleSave('filters')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm h-96">
                {JSON.stringify(sampleFilters, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Prompt Templates</CardTitle>
                <Button onClick={() => handleSave('templates')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm h-96">
                {JSON.stringify(promptTemplates, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
