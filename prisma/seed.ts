import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.log('ℹ️  Please check your database credentials and ensure the database exists');
    console.log('ℹ️  Try creating the database first: CREATE DATABASE labscare_report;');
    process.exit(1);
  }

  let lab;
  try {
    const existingLab = await prisma.lab.findFirst({
      where: { name: 'Demo Lab' },
    });

    if (existingLab) {
      lab = existingLab;
      console.log('✅ Lab already exists:', lab.name);
    } else {
      lab = await prisma.lab.create({
        data: {
          name: 'Demo Lab',
          domain: 'clinical',
          token: 'demo-token-12345',
          version: '1.0.0',
          fieldMappings: {
            'patientId': { cell: 'A2', type: 'string' },
            'sampleDate': { cell: 'B2', type: 'date' },
            'testResult': { cell: 'C2', type: 'string' },
          },
          extractionRules: {
            'numericExtraction': {
              pattern: '\\d+\\.\\d+',
              description: 'Extract numeric values with decimal points',
            },
          },
          sampleFilters: {
            'activeSamples': {
              field: 'status',
              operator: 'equals',
              value: 'active',
            },
          },
          promptTemplates: {
            'extraction': {
              name: 'Data Extraction',
              template: 'Extract {{fields}} from document',
              variables: ['fields'],
            },
          },
        },
      });
      console.log('✅ Created lab:', lab.name);
    }
  } catch (error) {
    console.error('❌ Failed to create lab:', error);
    process.exit(1);
  }

  let project;
  try {
    const existingProject = await prisma.project.findFirst({
      where: { limsPid: '3301322' },
    });

    if (existingProject) {
      project = existingProject;
      console.log('✅ Project already exists:', project.name);
    } else {
      project = await prisma.project.create({
        data: {
          labId: lab.id,
          limsPid: '3301322',
          name: 'Blood Test Analysis',
          description: 'Automated extraction of blood test results from PDF reports',
        },
      });
      console.log('✅ Created project:', project.name);
    }
  } catch (error) {
    console.error('❌ Failed to create project:', error);
    process.exit(1);
  }

  // Create sample reports
  const reports = await Promise.all([
    await prisma.report.create({
      data: {
        projectId: project.id,
        name: 'Patient Blood Test Report',
        description: 'Comprehensive blood test results for patient',
      },
    }),
    await prisma.report.create({
      data: {
        projectId: project.id,
        name: 'Annual Health Check Report',
        description: 'Annual health check blood test results',
      },
    }),
  ]);

  console.log('✅ Created reports:', reports.length);

  // Create sample documents
  const documents = await Promise.all([
    await prisma.document.create({
      data: {
        projectId: project.id,
        reportId: reports[0].id,
        name: 'blood_test_report.pdf',
        type: 'application/pdf',
        url: '/uploads/blood_test_report.pdf',
        status: 'COMPLETED',
        size: 512000,
        description: 'Blood test report PDF',
        storagePath: '/uploads/blood_test_report.pdf',
        pdf: '/uploads/blood_test_report.pdf',
        cover: '/uploads/blood_test_report_cover.jpg',
      },
    }),
    await prisma.document.create({
      data: {
        projectId: project.id,
        reportId: reports[0].id,
        name: 'patient_info.json',
        type: 'application/json',
        url: '/uploads/patient_info.json',
        status: 'COMPLETED',
        size: 2048,
        description: 'Patient information JSON',
        storagePath: '/uploads/patient_info.json',
        content: {
          patientId: 'P12345',
          name: 'John Doe',
          age: 35,
          gender: 'Male'
        },
      },
    }),
    await prisma.document.create({
      data: {
        projectId: project.id,
        reportId: reports[1].id,
        name: 'annual_health_check.pdf',
        type: 'application/pdf',
        url: '/uploads/annual_health_check.pdf',
        status: 'PROCESSING',
        size: 819200,
        description: 'Annual health check PDF',
        storagePath: '/uploads/annual_health_check.pdf',
      },
    }),
  ]);

  console.log('✅ Created documents:', documents.length);

  const schema = await prisma.schema.create({
    data: {
      projectId: project.id,
      name: 'Blood Test Schema',
      definition: {
        type: 'object',
        properties: {
          patientId: { type: 'string' },
          sampleDate: { type: 'string', format: 'date' },
          testResult: { type: 'string' },
        },
        required: ['patientId', 'sampleDate', 'testResult'],
      },
      version: '1.0.0',
    },
  });

  console.log('✅ Created schema:', schema.name);

  const script = await prisma.script.create({
    data: {
      projectId: project.id,
      name: 'Blood Test Extraction Script',
      code: `// Blood Test Extraction Script
function extractData(document) {
  const patientId = document.getCellValue('A2');
  const sampleDate = document.getCellValue('B2');
  const testResult = document.getCellValue('C2');
  
  return {
    patientId,
    sampleDate,
    testResult,
  };
}

return extractData(document);`,
      status: 'DRAFT',
    },
  });

  console.log('✅ Created script:', script.name);

  // Create sample report templates
  const templateData = [
    { id: 'blood-test', name: '血液检测报告', description: '血液生化指标分析报告' },
    { id: 'urinalysis', name: '尿常规报告', description: '尿液分析指标报告' },
    { id: 'comprehensive', name: '综合检测报告', description: '多项目综合分析报告' },
    { id: 'custom', name: '自定义报告', description: '自定义格式的分析报告' },
  ];

  const reportTemplates = await Promise.all(
    templateData.map(async (template) => {
      const existingTemplate = await prisma.reportTemplate.findFirst({
        where: { id: template.id },
      });

      if (existingTemplate) {
        console.log('✅ Report template already exists:', existingTemplate.name);
        return existingTemplate;
      } else {
        const newTemplate = await prisma.reportTemplate.create({
          data: template,
        });
        console.log('✅ Created report template:', newTemplate.name);
        return newTemplate;
      }
    })
  );

  console.log('✅ Processed report templates:', reportTemplates.length);

  // Create sample user
  let user;
  try {
    const existingUser = await prisma.user.findFirst({
      where: { id: 'user-001' },
    });

    if (existingUser) {
      user = existingUser;
      console.log('✅ User already exists:', user.username);
    } else {
      user = await prisma.user.create({
        data: {
          id: 'user-001',
          username: 'demo',
          email: 'demo@example.com',
          passwordHash: 'demo123',
        },
      });
      console.log('✅ Created user:', user.username);
    }
  } catch (error) {
    console.error('❌ Failed to create user:', error);
    process.exit(1);
  }

  // Create sample tasks
  const taskData = [
    {
      id: 'task-001',
      userId: user.id,
      labId: lab.id,
      name: '2024年血液检测报告批量分析',
      reportId: reports[0].id,
      reportType: 'blood-test',
      status: 'completed',
      progress: 100,
      result: {
        summary: '血液检测报告分析完成',
        totalFiles: 7,
        successful: 7,
        failed: 0,
      },
      duration: 1800000, // 30 minutes
      completedAt: new Date(Date.now() - 1800000),
    },
    {
      id: 'task-002',
      userId: user.id,
      labId: lab.id,
      name: '综合检测报告生成任务',
      reportId: reports[1].id,
      reportType: 'comprehensive',
      status: 'running',
      progress: 67,
    },
  ];

  const tasks = await Promise.all(
    taskData.map(async (task) => {
      const existingTask = await prisma.task.findFirst({
        where: { id: task.id },
      });

      if (existingTask) {
        console.log('✅ Task already exists:', existingTask.name);
        return existingTask;
      } else {
        const newTask = await prisma.task.create({
          data: task,
        });
        console.log('✅ Created task:', newTask.name);
        return newTask;
      }
    })
  );

  console.log('✅ Processed tasks:', tasks.length);

  // Create task logs for the running task
  const runningTask = tasks.find(task => task.id === 'task-002');
  if (runningTask) {
    // Check if task logs already exist
    const existingLogs = await prisma.taskLog.findMany({
      where: { taskId: runningTask.id },
    });

    if (existingLogs.length === 0) {
      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          type: 'info',
          content: '任务开始执行',
          metadata: { step: 'start' },
        },
      });

      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          type: 'info',
          content: '正在处理物料文件',
          metadata: { step: 'processing', progress: 33 },
        },
      });

      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          type: 'info',
          content: '正在生成报告',
          metadata: { step: 'generating', progress: 67 },
        },
      });

      console.log('✅ Created task logs');
    } else {
      console.log('✅ Task logs already exist');
    }
  }

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
