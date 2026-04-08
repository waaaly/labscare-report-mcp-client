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
          knowledgeBase: {
            'bloodTestGuide': {
              title: 'Blood Test Interpretation Guide',
              content: 'Reference guide for blood test results',
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
          caseId: 'CASE-2024-001',
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
    prisma.report.create({
      data: {
        projectId: project.id,
        name: 'Patient Blood Test Report',
        description: 'Comprehensive blood test results for patient',
      },
    }),
    prisma.report.create({
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
    prisma.document.create({
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
    prisma.document.create({
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
    prisma.document.create({
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

  // Create scripts with dataSource field
  const scripts = await Promise.all([
    prisma.script.create({
      data: {
        projectId: project.id,
        reportId: reports[0].id,
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
        dataSource: {
          type: 'pdf',
          source: 'blood_test_report.pdf',
          extractionRules: ['patientId', 'sampleDate', 'testResult'],
        },
      },
    }),
    prisma.script.create({
      data: {
        projectId: project.id,
        reportId: reports[1].id,
        name: 'Annual Health Check Extraction',
        code: `// Annual Health Check Extraction Script
function extractHealthData(document) {
  const checkDate = document.getCellValue('A1');
  const overallStatus = document.getCellValue('B1');
  
  return {
    checkDate,
    overallStatus,
  };
}

return extractHealthData(document);`,
        dataSource: {
          type: 'pdf',
          source: 'annual_health_check.pdf',
          extractionRules: ['checkDate', 'overallStatus'],
        },
      },
    }),
  ]);

  console.log('✅ Created scripts:', scripts.length);

  // Create sample tasks
  const tasks = await Promise.all(
    reports.map(async (report, index) => {
      const existingTask = await prisma.task.findFirst({
        where: { reportId: report.id },
      });

      if (existingTask) {
        console.log('✅ Task already exists for report:', report.name);
        return existingTask;
      } else {
        const taskData: any = {
          labId: lab.id,
          name: index === 0 ? '2024年血液检测报告批量分析' : '综合检测报告生成任务',
          reportId: report.id,
          reportType: index === 0 ? 'blood-test' : 'comprehensive',
          status: index === 0 ? 'completed' : 'running',
          progress: index === 0 ? 100 : 67,
          temperature: 0.7,
          maxTokens: 4000,
          model: 'claude-sonnet-4.5',
        };

        // Add additional fields for completed task
        if (index === 0) {
          Object.assign(taskData, {
            additionalInstructions: '请重点分析异常指标',
            result: {
              summary: '血液检测报告分析完成',
              totalFiles: 7,
              successful: 7,
              failed: 0,
            },
            duration: 1800000, // 30 minutes
            completedAt: new Date(Date.now() - 1800000),
          });
        } else {
          Object.assign(taskData, {
            additionalInstructions: '生成详细的健康建议',
          });
        }

        const newTask = await prisma.task.create({
          data: taskData,
        });
        console.log('✅ Created task:', newTask.name);
        return newTask;
      }
    })
  );

  console.log('✅ Processed tasks:', tasks.length);

  // Create task logs for the running task
  const runningTask = tasks.find(task => task.status === 'running');
  if (runningTask) {
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

  // Create a sample user
  const existingUser = await prisma.user.findFirst({
    where: { username: 'admin' },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@labscare.com',
        passwordHash: '$2a$10$YourHashedPasswordHere', // Placeholder hash
      },
    });
    console.log('✅ Created user: admin');
  } else {
    console.log('✅ User already exists: admin');
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
