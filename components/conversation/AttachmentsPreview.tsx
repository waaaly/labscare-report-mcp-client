'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Image as ImageIcon, File as FileIcon } from 'lucide-react';

export interface AttachmentItem {
  file: File;
  type: 'image' | 'json' | 'md';
  preview?: string;
  previewText?: string;
}

interface Props {
  attachments: AttachmentItem[];
  onRemove: (idx: number) => void;
}

export default function AttachmentsPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="px-3 pt-3 pb-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
        {attachments.map((att, idx) => (
          <Card key={idx} className="relative overflow-hidden">
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute right-1 top-1 rounded bg-background/80 hover:bg-background p-1"
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
                  <div className="h-24 w-full flex items-center justify-center text-muted-foreground">
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
                      <span>Loading preview…</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-2 text-[10px] text-muted-foreground">
                {(att.file.size / 1024).toFixed(1)} KB
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
