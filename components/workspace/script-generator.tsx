'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, Save, Download } from 'lucide-react';
import { callMcpTool } from '@/lib/mcp/client';

interface ScriptGeneratorProps {
  projectId: string;
}

export default function ScriptGenerator({ projectId }: ScriptGeneratorProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await callMcpTool('generateScript', {
        projectId,
        schema: {},
        mappings: [],
      });

      if (result.content && result.content[0]) {
        const content = result.content[0];
        setCode(typeof content.text === 'string' ? content.text : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Generated Script', code }),
      });

      if (!response.ok) throw new Error('Failed to save script');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save script');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extraction-script.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Script Generator</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={loading}>
            <Code className="mr-2 h-4 w-4" />
            {loading ? 'Generating...' : 'Generate Script'}
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={!code}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handleSave} disabled={!code}>
            <Save className="mr-2 h-4 w-4" />
            Save Script
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated JavaScript Script</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}

          {!code && !error && (
            <div className="text-center py-8 text-muted-foreground">
              Click &quot;Generate Script&quot; to create a JavaScript extraction script based on your
              schema and mappings
            </div>
          )}

          {code && (
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm h-96">
              <code>{code}</code>
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
