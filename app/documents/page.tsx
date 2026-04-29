'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Upload,
  Search,
  X,
  Image as ImageIcon,
  File as FileIcon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useLabStore } from '@/store/lab-store';

interface ProjectSimple {
  id: string;
  name: string;
  limsPid: string;
}

interface DocumentItem {
  id: string;
  projectId: string;
  reportId: string;
  name: string;
  type: string;
  url: string;
  size: number | null;
  storagePath: string | null;
  status: string;
  pdf: string | null;
  cover: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    limsPid: string;
  };
  report: {
    id: string;
    name: string;
  } | null;
}

interface DocumentsResponse {
  documents: DocumentItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon;
  if (type === 'application/json') return FileCode;
  return FileText;
}

function FileCode({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </svg>
  );
}

function getDisplayType(type: string): string {
  if (type.startsWith('image/')) return 'image';
  if (type === 'application/json') return 'json';
  if (type === 'text/markdown') return 'md';
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('word') || type.includes('document')) return 'doc';
  return type.split('/').pop() || type;
}

export default function DocumentsPage() {
  const { currentLab } = useLabStore();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 12, total: 0, totalPages: 0 });

  const [searchQuery, setSearchQuery] = useState('');
  const [projectNameFilter, setProjectNameFilter] = useState('');
  const [reportNameFilter, setReportNameFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; type: string; preview?: string; previewText?: string }[]>([]);
  const [projects, setProjects] = useState<ProjectSimple[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (!currentLab?.id) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (projectNameFilter) params.set('projectName', projectNameFilter);
      if (reportNameFilter) params.set('reportName', reportNameFilter);
      if (typeFilter && typeFilter !== 'all') params.set('type', typeFilter);
      params.set('page', String(pagination.page));
      params.set('pageSize', String(pagination.pageSize));

      const response = await fetch(`/api/labs/${currentLab.id}/documents?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data: DocumentsResponse = await response.json();
      setDocuments(data.documents);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, [currentLab?.id, searchQuery, projectNameFilter, reportNameFilter, typeFilter, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (currentLab?.id) {
      fetch(`/api/labs/${currentLab.id}/projects`)
        .then((res) => res.json())
        .then((data) => setProjects(data))
        .catch(() => {});
    }
  }, [currentLab?.id]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const activeFilters = [
    searchQuery ? { key: 'search', label: `"${searchQuery}"` } : null,
    projectNameFilter ? { key: 'projectName', label: `Project: ${projectNameFilter}` } : null,
    reportNameFilter ? { key: 'reportName', label: `Report: ${reportNameFilter}` } : null,
    typeFilter !== 'all' ? { key: 'type', label: `Type: ${getDisplayType(typeFilter)}` } : null,
  ].filter(Boolean) as { key: string; label: string }[];

  const handleClearFilters = () => {
    setSearchQuery('');
    setProjectNameFilter('');
    setReportNameFilter('');
    setTypeFilter('all');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, Math.min(page, prev.totalPages)) }));
  };

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const list = Array.from(fileList);
    const next: { file: File; type: string; preview?: string; previewText?: string }[] = [];
    const textForPreview: File[] = [];

    for (const f of list) {
      const isImg = f.type.startsWith('image/');
      const isJson = f.type === 'application/json' || f.name.toLowerCase().endsWith('.json');
      const isMd = f.type === 'text/markdown' || f.name.toLowerCase().endsWith('.md');

      if (!isImg && !isJson && !isMd) continue;

      next.push({
        file: f,
        type: f.type,
        preview: isImg ? URL.createObjectURL(f) : undefined,
        previewText: undefined,
      });

      if (isJson || isMd) textForPreview.push(f);
    }

    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next]);

      if (textForPreview.length > 0) {
        textForPreview.forEach(async (tf) => {
          try {
            const raw = await tf.text();
            let pretty = raw;
            const isLikelyJson = tf.type === 'application/json' || tf.name.toLowerCase().endsWith('.json');
            if (isLikelyJson) {
              try {
                const parsed = JSON.parse(raw);
                pretty = JSON.stringify(parsed, null, 2);
              } catch {}
            }
            const snippet = pretty.slice(0, 600);
            setAttachments((prev) =>
              prev.map((att) => (att.file === tf ? { ...att, previewText: snippet } : att))
            );
          } catch {}
        });
      }
    }
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return copy;
    });
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files);
      e.currentTarget.value = '';
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleUpload = async () => {
    if (!currentLab?.id) return;
    if (attachments.length === 0) {
      toast.error('Please select files to upload');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      attachments.forEach((att) => {
        formData.append('files', att.file);
      });

      const response = await fetch(
        `/api/labs/${currentLab.id}/projects/${selectedProjectId}/documents`,
        { method: 'POST', body: formData }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      toast.success(`${attachments.length} file(s) uploaded successfully`);
      setAttachments([]);
      setIsDrawerOpen(false);
      setSelectedProjectId('');
      fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (doc: DocumentItem) => {
    if (!currentLab?.id) return;
    try {
      const response = await fetch(
        `/api/labs/${currentLab.id}/projects/${doc.projectId}/documents/${doc.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Delete failed');
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    if (doc.url) {
      window.open(doc.url, '_blank');
    }
  };

  const handleDrawerClose = () => {
    attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
    setAttachments([]);
    setIsDrawerOpen(false);
    setSelectedProjectId('');
  };

  if (!currentLab) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">No Lab Selected</h2>
        <p className="text-muted-foreground">Please select a lab to manage documents</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage all your uploaded documents across projects</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by document, project or report..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          <Button
            variant={isFiltersExpanded || activeFilters.length > 0 ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setIsFiltersExpanded((v) => !v)}
            className="h-10 gap-2 shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs size-5">
                {activeFilters.length}
              </span>
            )}
          </Button>

          <Button onClick={() => setIsDrawerOpen(true)} className="h-10 shrink-0">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>

        <div
          className={`grid gap-3 transition-all duration-200 ease-in-out overflow-hidden ${
            isFiltersExpanded
              ? 'grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <Card className="border-dashed">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Project Name
                    </label>
                    <Input
                      placeholder="e.g. Salmonella Detection"
                      value={projectNameFilter}
                      onChange={(e) => {
                        setProjectNameFilter(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Report Name
                    </label>
                    <Input
                      placeholder="e.g. Q1 Analysis"
                      value={reportNameFilter}
                      onChange={(e) => {
                        setReportNameFilter(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className="h-9"
                    />
                  </div>

                  <div className="w-36">
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Document Type
                    </label>
                    <Select value={typeFilter} onValueChange={handleTypeFilterChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="image">Images</SelectItem>
                        <SelectItem value="application/json">JSON</SelectItem>
                        <SelectItem value="text/markdown">Markdown</SelectItem>
                        <SelectItem value="application/pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-9 gap-1.5 self-end"
                    disabled={activeFilters.length === 0}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Active:</span>
            {activeFilters.map((f) => (
              <Badge key={f.key} variant="secondary" className="gap-1 pl-2 pr-1 h-6 text-xs font-normal">
                {f.label}
                <button
                  onClick={() => {
                    if (f.key === 'search') {
                      handleSearch('');
                    } else if (f.key === 'projectName') {
                      setProjectNameFilter('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    } else if (f.key === 'reportName') {
                      setReportNameFilter('');
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    } else if (f.key === 'type') {
                      handleTypeFilterChange('all');
                    }
                  }}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Documents</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || projectNameFilter || reportNameFilter || typeFilter !== 'all'
                ? 'No documents match your filters'
                : 'Upload your first document to get started'}
            </p>
            {!searchQuery && !projectNameFilter && !reportNameFilter && typeFilter === 'all' && (
              <Button onClick={() => setIsDrawerOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {documents.map((doc) => {
              const Icon = getFileTypeIcon(doc.type);
              const displayType = getDisplayType(doc.type);
              return (
                <Card key={doc.id} className="group relative overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                  <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(doc);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium truncate pr-16">{doc.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {doc.project?.name || 'Unknown Project'}
                      </span>
                      {doc.report?.name && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {doc.report.name}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {doc.type.startsWith('image/') ? (
                      <div className="h-32 w-full bg-muted rounded flex items-center justify-center overflow-hidden">
                        {doc.url ? (
                          <img src={doc.url} alt={doc.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <div className="h-32 w-full overflow-auto rounded bg-muted/60 p-2 text-xs leading-snug">
                        {doc.pdf ? (
                          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                            <FileText className="h-8 w-8" />
                            <span className="text-xs">PDF Document</span>
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap text-muted-foreground">
                            Preview not available
                          </pre>
                        )}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="uppercase">{displayType}</span>
                      </div>
                      <span>{formatFileSize(doc.size)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pagination.page === pageNum ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => handlePageChange(pageNum)}
                      className="h-8 w-8"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </span>
            </div>
          )}
        </>
      )}

      <div
        className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-background border-t shadow-lg rounded-t-xl mx-4 mb-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Upload Documents</h2>
            <Button variant="ghost" size="icon" onClick={handleDrawerClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div
            className="p-4 min-h-[200px]"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/json,text/markdown,.md"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="mb-4">
              <label className="text-sm font-medium mb-1.5 block">Target Project</label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.limsPid})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {attachments.length === 0 ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supported formats: Images (PNG, JPG, etc.), JSON, Markdown (.md)
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {attachments.map((att, idx) => (
                    <Card key={idx} className="relative overflow-hidden">
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="absolute right-1 top-1 rounded bg-background/80 hover:bg-background p-1 z-10"
                        aria-label="Remove attachment"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <CardHeader className="py-2 pr-6">
                        <CardTitle className="text-xs font-medium truncate">{att.file.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2">
                        {att.type.startsWith('image/') ? (
                          att.preview ? (
                            <img src={att.preview} alt={att.file.name} className="h-24 w-full object-cover rounded" />
                          ) : (
                            <div className="h-24 w-full flex items-center justify-center text-muted-foreground bg-muted rounded">
                              <ImageIcon className="h-5 w-5" />
                            </div>
                          )
                        ) : (
                          <div className="h-24 w-full overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-snug">
                            {att.previewText ? (
                              <pre className="whitespace-pre-wrap">{att.previewText}</pre>
                            ) : (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <FileIcon className="h-4 w-4" />
                                <span>Loading preview...</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          {formatFileSize(att.file.size)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Add More
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleDrawerClose}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading}>
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload {attachments.length} file{attachments.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={handleDrawerClose}
        />
      )}
    </div>
  );
}
