'use client';

import { useEffect, useCallback } from 'react';
import { useScriptStore } from '@/store/script-store';
import { useLabStore } from '@/store/lab-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function ScriptsPage() {
  const { currentLab } = useLabStore();
  const {
    scripts,
    loadScripts,
    isLoading,
    pagination,
    setPagination
  } = useScriptStore();

  const searchTerm = '';
  const sortBy = 'createdAt';
  const sortOrder = 'desc';

  const fetchScripts = useCallback(() => {
    if (currentLab) {
      loadScripts(currentLab.id, {
        search: searchTerm,
        sortBy,
        sortOrder,
        page: pagination.page,
        pageSize: pagination.pageSize
      });
    }
  }, [currentLab, loadScripts, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const handlePageChange = (newPage: number) => {
    setPagination({ page: newPage });
  };

  const startIndex = (pagination.page - 1) * pagination.pageSize;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scripts</h1>
        <p className="text-muted-foreground">
          Manage your generated extraction scripts
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search scripts..."
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={sortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="name">Script Name</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder}>
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Loading scripts...</div>
          ) : scripts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No scripts found
            </div>
          ) : (
            <Table className="table-fixed">
              <TableHeader className="bg-[#ECFEFF]">
                <TableRow>
                  <TableHead className="w-1/3 text-[#164E63] font-medium">Script Name</TableHead>
                  <TableHead className="w-1/4 text-[#164E63] font-medium">Project Name</TableHead>
                  <TableHead className="w-1/4 text-[#164E63] font-medium">Report Name</TableHead>
                  <TableHead className="w-1/4 text-[#164E63] font-medium">Task Name</TableHead>
                  <TableHead className="w-1/6 text-[#164E63] font-medium">Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map((script) => (
                  <TableRow key={script.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <TableCell className="w-1/3 font-medium text-[#164E63]">
                      <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.name}</Link>
                    </TableCell>
                    <TableCell className="w-1/4 text-[#164E63]">
                      <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.projectName || '-'}</Link>
                    </TableCell>
                    <TableCell className="w-1/4 text-[#164E63]">
                      <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.reportName || '-'}</Link>
                    </TableCell>
                    <TableCell className="w-1/4 text-[#164E63]">
                      <Link href={`/scripts/${script.id}`} className="block w-full h-full">{script.taskName || '-'}</Link>
                    </TableCell>
                    <TableCell className="w-1/6 text-[#164E63]">
                      <Link href={`/scripts/${script.id}`} className="block w-full h-full">
                        {format(new Date(script.createdAt), 'MMM d, yyyy HH:mm')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(startIndex + pagination.pageSize, pagination.total)} of {pagination.total} scripts
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={pagination.page === 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}