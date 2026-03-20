'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Database } from 'lucide-react';
import { callMcpTool } from '@/lib/mcp/client';

interface LimsDataPanelProps {
  projectId: string;
}

export default function LimsDataPanel({ projectId }: LimsDataPanelProps) {
  const [processId, setProcessId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!processId) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await callMcpTool('getProcessData', { processId });
      if (result.content && result.content[0]) {
        const content = result.content[0];
        setData(typeof content.data === 'string' ? JSON.parse(content.data) : content.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LIMS data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">LIMS Data</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Query LIMS System</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Process ID..."
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading || !processId}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Process Data</h3>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          {!data && !error && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              Enter a Process ID to query the LIMS system for sample data
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
