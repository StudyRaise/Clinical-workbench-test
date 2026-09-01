// 用途：重置 doctor@test.com 的密码（用户不存在则创建），密码用 bcryptjs 哈希后落库
// 用法：node scripts\reset-doctor-password.js [新密码] [角色]
//       例：node scripts\reset-doctor-password.js            -> 密码 NewPass@2026，角色 doctor
//           node scripts\reset-doctor-password.js MyPass123 admin
// 依赖：需要先执行 pnpm install（复用 apps/api 依赖链里的 mysql2 与 bcryptjs）
// 连接：自动读取仓库根目录 .env 中的 DB_* 配置

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');

// pnpm 工作区中依赖符号链接位于各应用目录下，这里以 apps/api 为解析基准
function resolveDep(name) {
  const candidates = [
    path.join(root, 'apps', 'api', 'node_modules', name),
    path.join(root, 'node_modules', name)
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return require(p);
    }
  }
  const apiRequire = createRequire(path.join(root, 'apps', 'api', 'package.json'));
  return apiRequire(name);
}

// ---------- 1. 读取仓库根目录 .env ----------
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  console.error('[ERR] 未找到 .env，请先复制 .env.example 为 .env 并填写数据库连接。');
  process.exit(1);
}
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const DB = {
  host: env.DB_HOST || '127.0.0.1',
  port: Number(env.DB_PORT || 3306),
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'clinical_workbench'
};

// ---------- 2. 参数与密码 ----------
const EMAIL = 'doctor@test.com';
const newPassword = process.argv[2] || 'NewPass@2026';
const newRole = process.argv[3] || 'doctor'; // admin/doctor/nurse/researcher/patient

// ---------- 3. 连接 MySQL 并执行 ----------
async function main() {
  const bcrypt = resolveDep('bcryptjs');
  const mysql = resolveDep('mysql2/promise');
  const conn = await mysql.createConnection(DB);
  try {
    const hash = await bcrypt.hash(newPassword, 10);

    // 查询是否已存在
    const [rows] = await conn.query(
      'SELECT id, tenant_id, role FROM `user` WHERE email = ?',
      [EMAIL]
    );

    if (rows.length === 0) {
      // 不存在 -> 创建。需保证 public 租户存在（与 auth.service 的 ensureTenant 逻辑一致）
      const crypto = require('crypto');
      const id = crypto.randomUUID();
      const [tenants] = await conn.query('SELECT id FROM `tenant` WHERE id = ?', ['public']);
      if (tenants.length === 0) {
        await conn.query('INSERT INTO `tenant` (id, name) VALUES (?, ?)', ['public', 'public']);
        console.log('[OK] 已自动创建租户 public');
      }
      await conn.query(
        'INSERT INTO `user` (id, tenant_id, email, role, password_hash) VALUES (?, ?, ?, ?, ?)',
        [id, 'public', EMAIL, newRole, hash]
      );
      console.log(`[OK] 已创建用户 ${EMAIL}（角色 ${newRole}）`);
    } else {
      // 已存在 -> 更新密码并设为指定角色（保留原 id / tenant_id）
      await conn.query(
        'UPDATE `user` SET password_hash = ?, role = ? WHERE email = ?',
        [hash, newRole, EMAIL]
      );
      console.log(`[OK] 已重置用户 ${EMAIL} 的密码，角色设为 ${newRole}（原角色：${rows[0].role}）`);
    }

    console.log(`[OK] 新密码: ${newPassword}`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('[ERR] 执行失败:', e.message);
  process.exit(1);
});
