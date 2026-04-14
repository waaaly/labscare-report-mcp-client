'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function ScriptsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalScripts, setTotalScripts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // 获取脚本数据
  const fetchScripts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const labId = 'default'; // 这里应该根据实际情况获取 labId
      const response = await fetch(`/api/labs/${labId}/scripts?search=${searchTerm}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${currentPage}&pageSize=${pageSize}`);
      if (!response.ok) {
        throw new Error('Failed to fetch scripts');
      }
      const data = await response.json();
      setScripts(data.scripts);
      setTotalScripts(data.pagination.total);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      setError('Failed to load scripts. Please try again.');
      console.error('Error fetching scripts:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, sortBy, sortOrder, currentPage, pageSize]);

  // 初始加载和参数变化时重新获取数据
  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  // 分页计算
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedScripts = scripts;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scripts</h1>
        <p className="text-muted-foreground">
          Manage your generated extraction scripts
        </p>
      </div>

      {/* 搜索和排序 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search scripts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="name">Script Name</SelectItem>
                  <SelectItem value="projectName">Project Name</SelectItem>
                  <SelectItem value="reportName">Report Name</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">Loading scripts...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : (
            <Table className="table-fixed">
              <TableHeader className="bg-[#ECFEFF]">
                <TableRow>
                  <TableHead className="w-1/3 text-[#164E63] font-medium">Script Name</TableHead>
                  <TableHead className="w-1/4 text-[#164E63] font-medium">Project Name</TableHead>
                  <TableHead className="w-1/4 text-[#164E63] font-medium">Report Name</TableHead>
                  <TableHead className="w-1/6 text-[#164E63] font-medium">Created At</TableHead>
                  <TableHead className="w-1/6 text-[#164E63] font-medium">Updated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.length > 0 ? (
                  scripts.map((script) => (
                    <TableRow key={script.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <TableCell className="w-1/3 font-medium text-[#164E63]">
                        <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.name}</Link>
                      </TableCell>
                      <TableCell className="w-1/4 text-[#164E63]">
                        <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.projectName}</Link>
                      </TableCell>
                      <TableCell className="w-1/4 text-[#164E63]">
                        <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.reportName}</Link>
                      </TableCell>
                      <TableCell className="w-1/6 text-[#164E63]">
                        <Link href={`/scripts/${script.id}`} className="block w-full h-full">{new Date(script.createdAt).toLocaleString()}</Link>
                      </TableCell>
                      <TableCell className="w-1/6 text-[#164E63]">
                        <Link href={`/scripts/${script.id}`} className="block w-full h-full">{new Date(script.updatedAt).toLocaleString()}</Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No scripts found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(startIndex + pageSize, totalScripts)} of {totalScripts} scripts
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
