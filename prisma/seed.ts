import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const existingLab = await prisma.lab.findFirst({
    where: { name: 'Demo Lab' },
  });

  let lab;
  if (existingLab) {
    lab = existingLab;
    console.log('✅ Lab already exists:', lab.name);
  } else {
    lab = await prisma.lab.create({
      data: {
        name: 'Demo Lab',
        domain: 'clinical',
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

  const project = await prisma.project.create({
    data: {
      labId: lab.id,
      name: 'Blood Test Analysis',
      description: 'Automated extraction of blood test results from PDF reports',
    },
  });

  console.log('✅ Created project:', project.name);

  const document = await prisma.document.create({
    data: {
      projectId: project.id,
      name: 'blood_test_report.pdf',
      type: 'PDF',
      url: '/uploads/blood_test_report.pdf',
      annotations: {
        'A2': 'patientId',
        'B2': 'sampleDate',
        'C2': 'testResult',
      },
    },
  });

  console.log('✅ Created document:', document.name);

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
