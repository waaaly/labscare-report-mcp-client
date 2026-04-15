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
        labId: lab.id,
        projectId: project.id,
        name: 'Patient Blood Test Report',
        description: 'Comprehensive blood test results for patient',
      },
    }),
    prisma.report.create({
      data: {
        labId: lab.id,
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
        status: 'SUCCESS',
        size: 512000,
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
        status: 'SUCCESS',
        size: 2048,
        storagePath: '/uploads/patient_info.json',
        pdf: '/uploads/patient_info.json',
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
        storagePath: '/uploads/annual_health_check.pdf',
      },
    }),
  ]);

  console.log('✅ Created documents:', documents.length);

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
          projectId: project.id,
          reportId: report.id,
          status: index === 0 ? 'COMPLETED' : 'RUNNING',
          progress: index === 0 ? 100 : 67,
          model: 'claude-3-5-sonnet',
        };

        // Add additional fields for completed task
        if (index === 0) {
          Object.assign(taskData, {
            duration: 180, // 3 minutes in seconds
            completedAt: new Date(Date.now() - 180000),
          });
        }

        const newTask = await prisma.task.create({
          data: taskData,
        });
        console.log('✅ Created task:', newTask.id);
        return newTask;
      }
    })
  );

  console.log('✅ Processed tasks:', tasks.length);

  // Create scripts with dataSourceId
  const scripts = await Promise.all([
    prisma.script.create({
      data: {
        labId: lab.id,
        projectId: project.id,
        reportId: reports[0].id,
        taskId: tasks[0].id,
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
        dataSourceId: documents[0].id,
        version: 1,
      },
    }),
    prisma.script.create({
      data: {
        labId: lab.id,
        projectId: project.id,
        reportId: reports[1].id,
        taskId: tasks[1].id,
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
        dataSourceId: documents[2].id,
        version: 1,
      },
    }),
  ]);

  console.log('✅ Created scripts:', scripts.length);

  // Create task logs for the running task
  const runningTask = tasks.find(task => task.status === 'RUNNING');
  if (runningTask) {
    const existingLogs = await prisma.taskLog.findMany({
      where: { taskId: runningTask.id },
    });

    if (existingLogs.length === 0) {
      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          level: 'INFO',
          content: '任务开始执行',
        },
      });

      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          level: 'INFO',
          content: '正在处理物料文件',
        },
      });

      await prisma.taskLog.create({
        data: {
          taskId: runningTask.id,
          level: 'INFO',
          content: '正在生成报告',
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