'use client';

import { useState } from 'react';
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

  // 模拟脚本数据
  const scripts = [
    {
      id: '1',
      name: 'Blood Test Extractor',
      projectId: 'project-1',
      projectName: 'Cardiology Department',
      reportId: 'report-1',
      reportName: 'Annual Health Check',
      createdAt: '2026-04-10T10:00:00Z',
      updatedAt: '2026-04-12T14:30:00Z'
    },
    {
      id: '2',
      name: 'Urine Analysis Script',
      projectId: 'project-1',
      projectName: 'Cardiology Department',
      reportId: 'report-2',
      reportName: 'Follow-up Visit',
      createdAt: '2026-04-09T09:15:00Z',
      updatedAt: '2026-04-09T09:15:00Z'
    },
    {
      id: '3',
      name: 'Imaging Results Parser',
      projectId: 'project-2',
      projectName: 'Radiology Department',
      reportId: 'report-3',
      reportName: 'MRI Scan Results',
      createdAt: '2026-04-08T16:45:00Z',
      updatedAt: '2026-04-08T16:45:00Z'
    }
  ];

  // 过滤和排序脚本
  const filteredScripts = scripts
    .filter(script => {
      const searchLower = searchTerm.toLowerCase();
      return (
        script.name.toLowerCase().includes(searchLower) ||
        script.projectName.toLowerCase().includes(searchLower) ||
        script.reportName.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'createdAt') {
        return sortOrder === 'asc' 
          ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortBy === 'projectName') {
        return sortOrder === 'asc'
          ? a.projectName.localeCompare(b.projectName)
          : b.projectName.localeCompare(a.projectName);
      }
      if (sortBy === 'reportName') {
        return sortOrder === 'asc'
          ? a.reportName.localeCompare(b.reportName)
          : b.reportName.localeCompare(a.reportName);
      }
      return 0;
    });

  // 分页计算
  const totalPages = Math.ceil(filteredScripts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedScripts = filteredScripts.slice(startIndex, startIndex + pageSize);

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
              {paginatedScripts.map((script) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 分页 */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(startIndex + pageSize, filteredScripts.length)} of {filteredScripts.length} scripts
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
