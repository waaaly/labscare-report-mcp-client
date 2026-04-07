'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';

type FileType = 'image' | 'json' | 'md';

type DocumentFile = {
  id: string;
  name: string;
  type: FileType;
  size: number;
  preview?: string;
  previewText?: string;
  createdAt: Date;
};

const ITEMS_PER_PAGE = 12;

const mockFiles: DocumentFile[] = [
  { id: '1', name: 'report-2024.json', type: 'json', size: 24500, previewText: '{\n  "report": "sample data",\n  "items": []\n}', createdAt: new Date('2024-01-15') },
  { id: '2', name: 'analysis.md', type: 'md', size: 3200, previewText: '# Analysis Report\n\nThis is a sample markdown file...', createdAt: new Date('2024-01-14') },
  { id: '3', name: 'chart.png', type: 'image', size: 156000, preview: '/placeholder-chart.png', createdAt: new Date('2024-01-13') },
  { id: '4', name: 'data-export.json', type: 'json', size: 8900, previewText: '{\n  "export": "data",\n  "version": "1.0"\n}', createdAt: new Date('2024-01-12') },
  { id: '5', name: 'notes.md', type: 'md', size: 1200, previewText: '## Notes\n\n- Item 1\n- Item 2', createdAt: new Date('2024-01-11') },
  { id: '6', name: 'screenshot.png', type: 'image', size: 89000, preview: '/placeholder-screenshot.png', createdAt: new Date('2024-01-10') },
  { id: '7', name: 'config.json', type: 'json', size: 560, previewText: '{\n  "theme": "dark",\n  "lang": "en"\n}', createdAt: new Date('2024-01-09') },
  { id: '8', name: 'readme.md', type: 'md', size: 4500, previewText: '# Project README\n\nDocumentation here...', createdAt: new Date('2024-01-08') },
  { id: '9', name: 'diagram.png', type: 'image', size: 234000, preview: '/placeholder-diagram.png', createdAt: new Date('2024-01-07') },
  { id: '10', name: 'results.json', type: 'json', size: 12300, previewText: '{\n  "results": [],\n  "total": 0\n}', createdAt: new Date('2024-01-06') },
  { id: '11', name: 'guide.md', type: 'md', size: 6700, previewText: '# User Guide\n\nStep by step instructions...', createdAt: new Date('2024-01-05') },
  { id: '12', name: 'banner.png', type: 'image', size: 345000, preview: '/placeholder-banner.png', createdAt: new Date('2024-01-04') },
  { id: '13', name: 'sample.json', type: 'json', size: 2100, previewText: '{\n  "sample": true\n}', createdAt: new Date('2024-01-03') },
  { id: '14', name: 'template.md', type: 'md', size: 890, previewText: '# Template\n\nUse this as a starting point...', createdAt: new Date('2024-01-02') },
  { id: '15', name: 'logo.png', type: 'image', size: 45000, preview: '/placeholder-logo.png', createdAt: new Date('2024-01-01') },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeIcon(type: FileType) {
  switch (type) {
    case 'image':
      return ImageIcon;
    case 'json':
      return FileCode;
    default:
      return FileText;
  }
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

export default function DocumentsPage() {
  const [files, setFiles] = useState<DocumentFile[]>(mockFiles);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ file: File; type: FileType; preview?: string; previewText?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredFiles.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedFiles = filteredFiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const list = Array.from(fileList);
    const next: { file: File; type: FileType; preview?: string; previewText?: string }[] = [];
    const textForPreview: File[] = [];

    for (const f of list) {
      const isImg = f.type.startsWith('image/');
      const isJson = f.type === 'application/json' || f.name.toLowerCase().endsWith('.json');
      const isMd = f.type === 'text/markdown' || f.name.toLowerCase().endsWith('.md');

      if (!isImg && !isJson && !isMd) continue;

      next.push({
        file: f,
        type: isImg ? 'image' : isJson ? 'json' : 'md',
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

  const handleUpload = () => {
    const newFiles: DocumentFile[] = attachments.map((att, idx) => ({
      id: `new-${Date.now()}-${idx}`,
      name: att.file.name,
      type: att.type,
      size: att.file.size,
      preview: att.preview,
      previewText: att.previewText,
      createdAt: new Date(),
    }));

    setFiles((prev) => [...newFiles, ...prev]);
    setAttachments([]);
    setIsDrawerOpen(false);
  };

  const handleDeleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDrawerClose = () => {
    attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
    setAttachments([]);
    setIsDrawerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage all your uploaded documents across projects</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setIsDrawerOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
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
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground ml-2">
              Page {currentPage} of {totalPages}
            </span>
          </div>
        )}
      </div>

      {paginatedFiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Documents</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery ? 'No documents match your search' : 'Upload your first document to get started'}
            </p>
            {!searchQuery && (
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
            {paginatedFiles.map((file) => {
              const Icon = getFileTypeIcon(file.type);
              return (
                <Card key={file.id} className="group relative overflow-hidden hover:shadow-lg transition-all cursor-pointer">
                  <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
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
                        handleDeleteFile(file.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium truncate pr-16">{file.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    {file.type === 'image' ? (
                      <div className="h-32 w-full bg-muted rounded flex items-center justify-center overflow-hidden">
                        {file.preview ? (
                          <img src={file.preview} alt={file.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      <div className="h-32 w-full overflow-auto rounded bg-muted/60 p-2 text-xs leading-snug">
                        <pre className="whitespace-pre-wrap text-muted-foreground">
                          {file.previewText || 'Preview not available'}
                        </pre>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="uppercase">{file.type}</span>
                      </div>
                      <span>{formatFileSize(file.size)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
                        {att.type === 'image' ? (
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
                    <Button onClick={handleUpload}>
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
