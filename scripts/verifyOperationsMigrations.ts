import pg from 'pg';
import crypto from 'crypto';
import {getMigrationFiles,runMigrations} from '../src/dbMigrations';

const connectionString=process.env.DATABASE_URL || '';
const url=new URL(connectionString);
if(url.hostname!=='127.0.0.1' || url.port!=='55433' || url.pathname!=='/lms_mcna_codex_test') throw new Error('Use only the disposable local test cluster on 55433.');
const cluster=new pg.Pool({connectionString});
const migrations=getMigrationFiles();
const run=crypto.randomBytes(4).toString('hex');
try {
for(const scenario of ['fresh','upgrade']) {
  const name=`codex_operations_${scenario}_${run}`;
  if(!/^codex_operations_(fresh|upgrade)_[a-f0-9]{8}$/.test(name))throw new Error('Unsafe database name.');
  await cluster.query(`CREATE DATABASE "${name}"`);
  const target=new URL(url);target.pathname=`/${name}`;
  const db=new pg.Pool({connectionString:target.toString()});
  try {
    if(scenario==='upgrade') {
      await db.query('CREATE TABLE schema_migrations(version TEXT PRIMARY KEY,name TEXT NOT NULL,applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      for(const migration of migrations.filter(m=>Number(m.version)<40)) {
        const client=await db.connect();
        try {await client.query('BEGIN');await client.query(migration.sql);await client.query('INSERT INTO schema_migrations(version,name) VALUES($1,$2)',[migration.version,migration.name]);await client.query('COMMIT');}
        catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
      }
      await db.query("INSERT INTO users(id,email,password_hash,name,role,created_at) VALUES('kept-user','kept@example.com','fixture-only','Kept Learner','student','2026-01-01T00:00:00Z')");
    }
    const result=await runMigrations(db);
    const repeat=await runMigrations(db);
    if(repeat.applied.length)throw new Error('Migration rerun should be a no-op.');
    if(scenario==='upgrade' && (result.applied.length!==1 || !(await db.query("SELECT 1 FROM users WHERE id='kept-user' AND can_manage_sales=false")).rowCount)) throw new Error('Upgrade changed legacy learner or reapplied old migration.');
    const tables=['private_uploads','submission_versions','teacher_subjects','teaching_months','lesson_plan_templates','session_solutions','operation_settings','consultation_requests','course_recommendations','vouchers','upsell_orders','operation_dispatches'];
    for(const table of tables)if(!(await db.query('SELECT to_regclass($1) name',[table])).rows[0].name)throw new Error(`Missing ${table}`);
    const rules=(await db.query("SELECT value FROM operation_settings WHERE id='rules'")).rows[0]?.value;
    if(rules?.commissionStart!==null || rules?.bankAccount!=='' || rules?.tierRules.length!==0)throw new Error('Unsafe default business settings.');
    console.log(`${scenario}: migrations through 040, repeat safety and defaults passed (${result.applied.length} applied). Temporary database: ${name}`);
  }finally{await db.end();}
}
}finally{await cluster.end();}
