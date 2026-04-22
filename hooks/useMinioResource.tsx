'use client';

import { useState, useEffect, useCallback } from 'react';

const MINIO_HOST = process.env.NEXT_PUBLIC_MINIO_PUBLIC_HOST || 'http://localhost:9000';

export function useMinioResource<T = any>(urlPath: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!urlPath);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    // 拼接地址：注意确保 MINIO_HOST 不以 / 结尾，path 以 / 开头，或者自行处理斜杠
    const fullUrl = path.startsWith('http') 
      ? path 
      : `${MINIO_HOST.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

    try {
      const response = await fetch(fullUrl, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`MinIO Fetch Error: ${response.status} ${response.statusText}`);
      }
      const json = await response.json();
      console.log('json', typeof json);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlPath) {
      console.log('urlPath', urlPath);
      fetchData(urlPath);
    } else {
      setData(null);
      setLoading(false);
    }
  }, [urlPath, fetchData]);

  return { data, loading, error, refresh: () => urlPath && fetchData(urlPath) };
}
