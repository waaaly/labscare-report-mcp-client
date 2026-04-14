import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(request: NextRequest, { params }: { params: { labId: string } }) {
  const { labId } = params;
  const searchParams = request.nextUrl.searchParams;
  const searchTerm = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');

  // 过滤脚本
  let filteredScripts = scripts.filter(script => {
    const searchLower = searchTerm.toLowerCase();
    return (
      script.name.toLowerCase().includes(searchLower) ||
      script.projectName.toLowerCase().includes(searchLower) ||
      script.reportName.toLowerCase().includes(searchLower)
    );
  });

  // 排序脚本
  filteredScripts.sort((a, b) => {
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
  const totalScripts = filteredScripts.length;
  const totalPages = Math.ceil(totalScripts / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paginatedScripts = filteredScripts.slice(startIndex, startIndex + pageSize);

  return NextResponse.json({
    scripts: paginatedScripts,
    pagination: {
      total: totalScripts,
      page,
      pageSize,
      totalPages
    }
  });
}
