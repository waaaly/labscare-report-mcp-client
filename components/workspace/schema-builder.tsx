'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save } from 'lucide-react';

interface SchemaBuilderProps {
  projectId: string;
}

export default function SchemaBuilder({ projectId }: SchemaBuilderProps) {
  const [fields, setFields] = useState<Array<{ id: string; name: string; type: string; required: boolean }>>([]);

  const addField = () => {
    setFields([...fields, { id: Date.now().toString(), name: '', type: 'string', required: false }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, key: string, value: string | boolean) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, [key]: value } : f)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schema Builder</h2>
        <div className="flex gap-2">
          <Button variant="outline">
            <Save className="mr-2 h-4 w-4" />
            Save Schema
          </Button>
          <Button onClick={addField}>
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schema Definition</CardTitle>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No fields defined yet. Click &quot;Add Field&quot; to start building your schema.
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Field name"
                    value={field.name}
                    onChange={(e) => updateField(field.id, 'name', e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => updateField(field.id, 'type', e.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="date">Date</option>
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateField(field.id, 'required', e.target.checked)}
                    />
                    Required
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated JSON Schema</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            {JSON.stringify(
              {
                type: 'object',
                properties: fields.reduce((acc, field) => {
                  acc[field.name] = { type: field.type };
                  return acc;
                }, {} as Record<string, { type: string }>),
                required: fields.filter((f) => f.required).map((f) => f.name),
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
