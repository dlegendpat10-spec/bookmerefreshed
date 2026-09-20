const { Client } = require('pg');

async function test(url, name) {
  console.log(`Testing ${name}...`);
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    console.log(`Connected ${name}! Running query...`);
    const res = await client.query('SELECT current_database(), current_user, count(*) from businesses');
    console.log(`SUCCESS ${name}:`, res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`Failed ${name}:`, err.message);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

async function run() {
  await test('postgresql://bookme_app.imoihsuizdwxaryhjwjt:BookmeSecurePass2026!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true', 'Pooler 6543 with project-ref user');
  await test('postgresql://bookme_app:BookmeSecurePass2026!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true', 'Pooler 6543 with plain user');
  await test('postgresql://bookme_app.imoihsuizdwxaryhjwjt:BookmeSecurePass2026!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres', 'Session 5432 with project-ref user');
  await test('postgresql://bookme_app:BookmeSecurePass2026!@aws-0-eu-central-1.pooler.supabase.com:5432/postgres', 'Session 5432 with plain user');
}

run();
