'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';

interface AnnotationMappingProps {
  projectId: string;
}

export default function AnnotationMapping({ projectId }: AnnotationMappingProps) {
  const [mappings, setMappings] = useState<Array<{ id: string; cell: string; field: string }>>([]);

  const addMapping = () => {
    setMappings([...mappings, { id: Date.now().toString(), cell: '', field: '' }]);
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
  };

  const updateMapping = (id: string, key: 'cell' | 'field', value: string) => {
    setMappings(mappings.map((m) => (m.id === id ? { ...m, [key]: value } : m)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Annotation Mapping</h2>
        <Button onClick={addMapping}>
          <Plus className="mr-2 h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Field Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mappings yet. Click "Add Mapping" to create your first field mapping.
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <div key={mapping.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Cell reference (e.g., A1, B2)"
                    value={mapping.cell}
                    onChange={(e) => updateMapping(mapping.id, 'cell', e.target.value)}
                    className="flex-1"
                  />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="System field name"
                    value={mapping.field}
                    onChange={(e) => updateMapping(mapping.id, 'field', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMapping(mapping.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
