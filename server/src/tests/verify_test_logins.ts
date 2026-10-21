import app from '../app';
import { dbClient } from '../db/client';

async function testLogins() {
  await dbClient.init();
  const server = app.listen(0);
  const port = (server.address() as any).port;

  const testAccounts = [
    { role: 'SUPER_ADMIN', email: 'superadmin@beltflow.test' },
    { role: 'ADMIN_PERSATUAN', email: 'admin@selangor.silambam.test' },
    { role: 'MASTER', email: 'master.ravi@selangor.silambam.test' },
    { role: 'PARENT', email: 'parent.suresh@family.test' },
    { role: 'STUDENT', email: 'student.aryan@beltflow.test' },
  ];

  console.log(`Testing logins against ephemeral port ${port}...`);

  for (const acc of testAccounts) {
    const res = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: acc.email, password: 'TestPass2026!' }),
    });

    const data: any = await res.json();
    if (res.status === 200 && data.token && data.user?.role === acc.role) {
      console.log(`✅ [${acc.role}] ${acc.email} logged in successfully! Name: ${data.user.fullName}`);
    } else {
      console.error(`❌ [${acc.role}] Login failed! Status: ${res.status}`, data);
      server.close();
      process.exit(1);
    }
  }

  server.close();
  await dbClient.close();
  console.log('🎉 All 5 role test accounts verified with valid JWT tokens!');
  process.exit(0);
}

testLogins().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
