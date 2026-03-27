'use client'

import { useProjectStore } from '@/store/project-store'
import { Document } from '@/types'
import { useState, useEffect } from 'react'

export type DocUploadProgress = {
  progress: number
  msg: string
}

export function useDocUploadProgress(documentId: string) {
  const { documents } = useProjectStore();
  const { currentProject } = useProjectStore();
  const selectedDocument = documents.find(d => d.id === documentId);
  const [progress, setProgress] = useState<DocUploadProgress>({
    progress: 0,
    msg: ''
  })

  useEffect(() => {
    console.log('setCurrentProject', selectedDocument, documents)
    let eventSource: EventSource | null = null
    if(!documentId) return
    // 建立 SSE 连接
    eventSource = new EventSource(`/api/sse/doc-upload-progress/${documentId}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setProgress({
          progress: data.progress || 0,
          msg: data.msg || ''
        })
      } catch (error) {
        console.error('Error parsing SSE message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      eventSource?.close()
    }

    // 清理函数
    return () => {
      eventSource?.close()
    }
  }, [documentId])

  return progress
}