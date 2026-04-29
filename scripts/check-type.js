const { spawn } = require('child_process');
const fs = require('fs');

// 日志文件路径
const logFilePath = './typecheck.log';

// 使用 spawn 可以实时获取输出，更适合长耗时任务
// 在 Windows 上运行 npx 必须带 shell: true
const child = spawn('npx', ['tsc', '--noEmit'], { shell: true });

let hasError = false;
let outputBuffer = '';

// 监听标准输出
child.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  process.stdout.write(output); // 实时打印到控制台
});

// 监听标准错误输出
child.stderr.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;
  process.stderr.write(output);
  hasError = true;
});

// 进程结束时的处理
child.on('close', (code) => {
  // 将输出写入日志文件
  fs.writeFileSync(logFilePath, outputBuffer);
  
  if (hasError || code !== 0) {
    console.log('\n❌ 类型检查失败: 发现语法或类型错误。');
    console.log(`   详细错误信息已保存到: ${logFilePath}`);
    process.exit(1);
  } else {
    console.log('\n✅ 类型检查通过！');
    // 删除空的日志文件
    if (outputBuffer.trim() === '') {
      fs.unlinkSync(logFilePath);
    } else {
      console.log(`   检查结果已保存到: ${logFilePath}`);
    }
    process.exit(0);
  }
});