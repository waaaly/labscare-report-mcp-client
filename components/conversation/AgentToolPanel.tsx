'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  logs: string[];
};

export default function AgentToolPanel({ logs }: Props) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Agent & Tools</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 overflow-auto">
        <section>
          <h3 className="text-sm font-medium mb-2">Tool Calls</h3>
          <div className="text-sm text-muted-foreground border rounded-md p-3">
            No tool calls yet
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium mb-2">MCP Tasks</h3>
          <div className="text-sm text-muted-foreground border rounded-md p-3">
            No tasks yet
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium mb-2">Logs</h3>
          <div className="border rounded-md p-3 h-72 overflow-auto bg-muted/50 text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-muted-foreground">No logs</div>
            ) : (
              logs.map((l, i) => <div key={i}>{l}</div>)
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

