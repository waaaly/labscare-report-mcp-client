'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Terminal, X } from 'lucide-react';
// import { logger } from '@/lib/logger';

interface ExecutionDebugProps {
  projectId: string;
}

export default function ExecutionDebug({ projectId }: ExecutionDebugProps) {
  const [code, setCode] = useState('// Enter your JavaScript code here\nconsole.log("Hello, LabFlow!");');
  const [logs, setLogs] = useState<Array<{ timestamp: string; type: string; message: string }>>([]);
  const [running, setRunning] = useState(false);

  const handleRun = () => {
    setRunning(true);
    setLogs([]);

    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args: unknown[]) => {
      // logger.info( {...args},'Script output:',);
      logs.push({
        timestamp: new Date().toISOString(),
        type: 'log',
        message: args.map((arg) => String(arg)).join(' '),
      });
      originalLog(...args);
    };

    console.error = (...args: unknown[]) => {
      // logger.info( {...args},'Script error:',);
      logs.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: args.map((arg) => String(arg)).join(' '),
      });
      originalError(...args);
    };

    try {
      eval(code);
    } catch (err) {
      logs.push({
        timestamp: new Date().toISOString(),
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      console.log = originalLog;
      console.error = originalError;
      setRunning(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Execution & Debug</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearLogs} disabled={logs.length === 0}>
            <X className="mr-2 h-4 w-4" />
            Clear Logs
          </Button>
          <Button onClick={handleRun} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? 'Running...' : 'Run Script'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Script Editor</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 font-mono text-sm bg-muted p-4 rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter your JavaScript code here..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 overflow-y-auto bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
              {logs.length === 0 ? (
                <div className="text-muted-foreground">
                  No logs yet. Run the script to see output.
                </div>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`flex gap-2 ${
                      log.type === 'error' ? 'text-destructive' : 'text-foreground'
                    }`}
                  >
                    <span className="text-muted-foreground shrink-0">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
