'use client';

import { useState, useEffect } from 'react';
import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings, Loader2, Zap, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getMcpClient, closeMcpClient, callMcpTool, listMcpTools } from '@/lib/mcp/client';

export default function SettingsPage() {
  const { t } = useTranslation('common');
  const { currentLab, updateLab } = useLabStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: currentLab?.name || '',
    domain: currentLab?.domain || '',
    version: currentLab?.version || '',
    account: currentLab?.account || '',
    token: currentLab?.token || '',
  });
 useEffect(() => {
    if (currentLab) {
      setFormData({
        name: currentLab.name,
        domain: currentLab.domain,
        version: currentLab.version,
        account: currentLab.account,
        token: currentLab.token,
      });
    }
  }, [currentLab]);

  const handleConnectMcp = async () => {
    setIsConnecting(true);
    setMcpError(null);
    try {
      await getMcpClient();
      const tools = await listMcpTools();
      const toolNames = tools.tools.map((t: any) => t.name);
      setAvailableTools(toolNames);
      setIsConnected(true);
      toast.success('MCP Server connected successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to MCP server';
      setMcpError(errorMessage);
      setIsConnected(false);
      toast.error(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectMcp = async () => {
    try {
      await closeMcpClient();
      setIsConnected(false);
      setAvailableTools([]);
      toast.success('MCP Server disconnected');
    } catch (error) {
      toast.error('Failed to disconnect from MCP server');
    }
  };
  if (!currentLab) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Please select a lab first</div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateLab({
        name: formData.name,
        domain: formData.domain,
        version: formData.version,
        account: formData.account,
        token: formData.token,
      });
      
      if (success) {
        toast.success(t('success'));
      } else {
        toast.error(t('error'));
      }
    } catch {
      toast.error(t('error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure {currentLab.name} settings and preferences
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lab Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Lab Name</label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Domain</label>
              <Input 
                value={formData.domain} 
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="e.g., clinical, research" 
              />
            </div>
              <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <Input 
                value={formData.account} 
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                placeholder="Enter account name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Token</label>
              <Input 
                type="password"
                value={formData.token} 
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="Enter API token"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Version</label>
              <Input 
                value={formData.version} 
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MCP Server Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isConnected ? `${availableTools.length} tools available` : 'Click to connect'}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDisconnectMcp}
                >
                  Disconnect
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  onClick={handleConnectMcp}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {mcpError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{mcpError}</p>
              </div>
            )}
            
            {isConnected && availableTools.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Available Tools:</p>
                <div className="flex flex-wrap gap-2">
                  {availableTools.map((tool) => (
                    <span 
                      key={tool} 
                      className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
