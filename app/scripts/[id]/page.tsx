'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Code, Database, FileText } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ScriptDetails {
  id: string;
  name: string;
  code: string;
  dataSource: any;
  projectId: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
}

export default function ScriptDetailPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  // 模拟脚本详情数据
  const script: ScriptDetails = {
    id: '1',
    name: 'Blood Test Extractor',
    code: `// Blood test results extraction script
function extractBloodTestResults(data) {
  const results = {
    hemoglobin: null,
    platelets: null,
    whiteBloodCells: null,
    redBloodCells: null
  };

  // Extract hemoglobin
  const hemoglobinMatch = data.match(/Hemoglobin:\s*(\d+\.\d+)/i);
  if (hemoglobinMatch) {
    results.hemoglobin = parseFloat(hemoglobinMatch[1]);
  }

  // Extract platelets
  const plateletsMatch = data.match(/Platelets:\s*(\d+)/i);
  if (plateletsMatch) {
    results.platelets = parseInt(plateletsMatch[1]);
  }

  // Extract white blood cells
  const wbcMatch = data.match(/White Blood Cells:\s*(\d+\.\d+)/i);
  if (wbcMatch) {
    results.whiteBloodCells = parseFloat(wbcMatch[1]);
  }

  // Extract red blood cells
  const rbcMatch = data.match(/Red Blood Cells:\s*(\d+\.\d+)/i);
  if (rbcMatch) {
    results.redBloodCells = parseFloat(rbcMatch[1]);
  }

  return results;
}

// Example usage
const testData = "Patient ID: 12345\nHemoglobin: 14.5 g/dL\nPlatelets: 250000\nWhite Blood Cells: 6.2\nRed Blood Cells: 5.1\n";

console.log(extractBloodTestResults(testData));
`,
    dataSource: {
      "patientId": "12345",
      "testType": "Complete Blood Count",
      "sampleId": "SMP-67890",
      "collectionDate": "2026-04-10",
      "results": {
        "hemoglobin": "14.5 g/dL",
        "platelets": "250,000",
        "whiteBloodCells": "6.2",
        "redBloodCells": "5.1"
      }
    },
    projectId: 'project-1',
    reportId: 'report-1',
    createdAt: '2026-04-10T10:00:00Z',
    updatedAt: '2026-04-12T14:30:00Z'
  };

  const handleRunScript = () => {
    setIsRunning(true);
    // 模拟脚本运行
    setTimeout(() => {
      setRunResult({
        "status": "success",
        "data": {
          "hemoglobin": 14.5,
          "platelets": 250000,
          "whiteBloodCells": 6.2,
          "redBloodCells": 5.1
        },
        "executionTime": "150ms"
      });
      setIsRunning(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Script Details</h1>
        <p className="text-muted-foreground">
          View and manage your script
        </p>
      </div>

      {/* 顶部卡片展示脚本数据和模拟运行按钮 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-2xl">{script.name}</CardTitle>
          <Button 
            onClick={handleRunScript}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? 'Running...' : (
              <>
                <Play className="h-4 w-4" />
                Run Script
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Project ID</p>
            <p>{script.projectId}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Report ID</p>
            <p>{script.reportId}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Created At</p>
            <p>{new Date(script.createdAt).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Updated At</p>
            <p>{new Date(script.updatedAt).toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>

      {/* 主体内容：左侧JS编辑器，右侧Tab布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧JS编辑器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Script Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <SyntaxHighlighter 
                language="javascript" 
                style={vscDarkPlus}
                className="rounded-md"
              >
                {script.code}
              </SyntaxHighlighter>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 右侧Tab布局 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Script Data & Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="data">
              <TabsList className="mb-4">
                <TabsTrigger value="data" className="flex items-center gap-1">
                  <Database className="h-4 w-4" />
                  Data Source
                </TabsTrigger>
                <TabsTrigger value="results" className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Run Results
                </TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="h-[540px]">
                <ScrollArea className="h-full">
                  <pre className="bg-muted p-4 rounded-md text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(script.dataSource, null, 2)}
                  </pre>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="results" className="h-[540px]">
                <ScrollArea className="h-full">
                  {runResult ? (
                    <pre className="bg-muted p-4 rounded-md text-sm font-mono whitespace-pre-wrap">
                      {JSON.stringify(runResult, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Run the script to see results
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
