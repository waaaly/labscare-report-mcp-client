const { spawn } = require('child_process');

// 使用 spawn 可以实时获取输出，更适合长耗时任务
// 在 Windows 上运行 npx 必须带 shell: true
const child = spawn('npx', ['tsc', '--noEmit'], { shell: true });

let hasError = false;

// 监听标准输出
child.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output); // 实时打印到控制台让 Agent 看到
  
  // 检查是否包含错误标识
  if (output.toLowerCase().includes('error ts')) {
    hasError = true;
  }
});

// 监听标准错误输出
child.stderr.on('data', (data) => {
  process.stderr.write(data);
  hasError = true;
});

// 进程结束时的处理
child.on('close', (code) => {
  if (hasError || code !== 0) {
    console.log('\n❌ 类型检查失败: 发现语法或类型错误。');
    process.exit(1); // 强制返回非零状态码
  } else {
    console.log('\n✅ 类型检查通过！');
    process.exit(0);
  }
});
