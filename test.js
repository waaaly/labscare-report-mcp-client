const { Client } = require('pg');

// 替换为你的数据库配置
const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '5426986', 
  database: 'postgres', // 默认数据库
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ 数据库连接成功！');
    
    // 执行一个简单的查询
    const res = await client.query('SELECT NOW() as current_time, version();');
    console.log('服务器时间:', res.rows[0].current_time);
    console.log('版本信息:', res.rows[0].version);
    
  } catch (err) {
    console.error('❌ 连接失败:', err.message);
    
    // 常见错误提示
    if (err.message.includes('password authentication failed')) {
      console.log('👉 提示：密码错误，请检查你的数据库密码。');
    } else if (err.message.includes('ECONNREFUSED')) {
      console.log('👉 提示：连接被拒绝，请确保 PostgreSQL 服务已启动。');
    }
  } finally {
    await client.end();
  }
}

testConnection();