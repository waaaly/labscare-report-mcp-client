#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const issues = [];
const fixes = [];

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      if (line.includes('interface') && line.includes(':')) {
        if (!line.includes('{')) {
          issues.push({
            file: filePath,
            line: lineNum,
            type: 'syntax',
            message: 'Interface declaration missing opening brace',
            severity: 'error'
          });
        }
      }
      
      if (line.includes('export default function') && !line.includes('interface')) {
        const match = line.match(/\(([^)]+)\)/);
        if (match && !match[1].includes(':')) {
          issues.push({
            file: filePath,
            line: lineNum,
            type: 'type',
            message: 'Function props should be typed with interface',
            severity: 'warning'
          });
          fixes.push({
            file: filePath,
            line: lineNum,
            action: 'Add interface for props above function'
          });
        }
      }
      
      if (line.includes('useState(') && !line.includes('<')) {
        const match = line.match(/useState\(([^)]+)\)/);
        if (match && match[1] === '') {
          issues.push({
            file: filePath,
            line: lineNum,
            type: 'type',
            message: 'useState missing type parameter',
            severity: 'error'
          });
        }
      }
      
      if (line.includes('any') && !line.includes('//') && !line.includes('*')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'type',
          message: 'Usage of "any" type detected',
          severity: 'warning'
        });
      }
      
      if (line.includes('console.log') && !line.includes('// TODO') && !line.includes('// DEBUG')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'best-practice',
          message: 'Console.log should be removed in production',
          severity: 'warning'
        });
      }
      
      if (line.includes('.then(') && !line.includes('.catch(')) {
        issues.push({
          file: filePath,
          line: lineNum,
          type: 'error-handling',
          message: 'Promise without error handling',
          severity: 'warning'
        });
      }
      
      if (line.includes('import') && line.includes("from 'react'")) {
        const imports = line.match(/import\s+{([^}]+)}/);
        if (imports) {
          const importsList = imports[1].split(',').map(i => i.trim());
          if (importsList.includes('useState') && !importsList.includes('useEffect')) {
            issues.push({
              file: filePath,
              line: lineNum,
              type: 'imports',
              message: 'Missing useEffect import',
              severity: 'error'
            });
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error.message);
  }
}

function scanDirectory(dir, extensions = ['.ts', '.tsx']) {
  const files = [];
  
  function scan(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    items.forEach(item => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!item.startsWith('.') && item !== 'node_modules' && item !== '.next') {
          scan(fullPath);
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    });
  }
  
  scan(dir);
  return files;
}

function main() {
  console.log('🔍 Scanning project for TypeScript issues...\n');
  
  const projectDir = process.cwd();
  const files = scanDirectory(projectDir);
  
  files.forEach(file => {
    checkFile(file);
  });
  
  console.log(`\n📊 Scan Results:`);
  console.log(`   Total files scanned: ${files.length}`);
  console.log(`   Issues found: ${issues.length}`);
  
  if (issues.length > 0) {
    console.log(`\n❌ Issues by Severity:`);
    
    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log(`\n🔴 Errors:`);
      errors.forEach(issue => {
        console.log(`   [${issue.file}:${issue.line}] ${issue.type}: ${issue.message}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n🟡 Warnings:`);
      warnings.forEach(issue => {
        console.log(`   [${issue.file}:${issue.line}] ${issue.type}: ${issue.message}`);
      });
    }
    
    console.log(`\n💡 Suggested Fixes:`);
    fixes.slice(0, 10).forEach(fix => {
      console.log(`   [${fix.file}:${fix.line}] ${fix.action}`);
    });
    
    console.log(`\n📝 Run 'npm run typecheck' to see full TypeScript errors`);
    console.log(`📝 Run 'npm run lint' to see ESLint warnings`);
  } else {
    console.log(`\n✅ No issues found!`);
    console.log(`📝 Run 'npm run typecheck' to verify TypeScript compilation`);
    console.log(`📝 Run 'npm run lint' to check code quality`);
  }
  
  console.log(`\n📚 See docs/typescript-guide.md for TypeScript best practices`);
}

main();
