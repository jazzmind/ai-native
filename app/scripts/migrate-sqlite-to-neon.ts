import 'dotenv/config';
import Database from 'better-sqlite3';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SQLITE_PATH = path.join(__dirname, '..', 'coach-router.db');
const USER_ID = 'wes@sonnenreich.com';

async function main() {
  // --- SQLite ---
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // --- Neon ---
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = neon(DATABASE_URL);

  console.log('Connected to both databases.\n');

  // Step 1: Get or create org for wes@sonnenreich.com
  console.log('--- Step 1: Organization ---');
  let orgRows = await sql`SELECT id, name, plan FROM organizations WHERE id IN (
    SELECT org_id FROM org_memberships WHERE user_id = ${USER_ID}
  ) LIMIT 1`;

  let orgId: string;
  if (orgRows.length > 0) {
    orgId = orgRows[0].id;
    console.log(`Found existing org: ${orgRows[0].name} (${orgId})`);
  } else {
    orgId = randomUUID();
    const orgName = "Wes's Team";
    const slug = `wes-${Date.now().toString(36)}`;
    const membershipId = randomUUID();
    await sql`INSERT INTO organizations (id, name, slug, plan) VALUES (${orgId}, ${orgName}, ${slug}, 'free')`;
    await sql`INSERT INTO org_memberships (id, org_id, user_id, role) VALUES (${membershipId}, ${orgId}, ${USER_ID}, 'owner')`;
    console.log(`Created org: ${orgName} (${orgId})`);
  }

  // Step 2: Migrate projects
  console.log('\n--- Step 2: Projects ---');
  const sqliteProjects = sqlite.prepare(`SELECT * FROM projects WHERE user_id = ?`).all(USER_ID) as any[];
  // Also grab legacy default project
  const legacyProject = sqlite.prepare(`SELECT * FROM projects WHERE id = 'default-project'`).get() as any;

  const allProjects = [...sqliteProjects];
  if (legacyProject && !sqliteProjects.find((p: any) => p.id === 'default-project')) {
    allProjects.push(legacyProject);
  }

  for (const p of allProjects) {
    const existing = await sql`SELECT id FROM projects WHERE id = ${p.id}`;
    if (existing.length > 0) {
      console.log(`  Project already exists: ${p.name} (${p.id}) — skipping`);
      continue;
    }
    await sql`INSERT INTO projects (id, org_id, user_id, name, description, is_default, created_at, updated_at)
      VALUES (${p.id}, ${orgId}, ${USER_ID}, ${p.name}, ${p.description || ''}, ${p.is_default === 1}, ${new Date(p.created_at)}, ${new Date(p.updated_at)})`;
    console.log(`  Migrated project: ${p.name} (${p.id})`);
  }

  // Step 3: Migrate conversations
  console.log('\n--- Step 3: Conversations ---');
  const projectIds = allProjects.map((p: any) => p.id);
  const sqliteConvos = sqlite.prepare(
    `SELECT * FROM conversations WHERE project_id IN (${projectIds.map(() => '?').join(',')}) OR user_id = ?`
  ).all(...projectIds, USER_ID) as any[];

  for (const c of sqliteConvos) {
    const existing = await sql`SELECT id FROM conversations WHERE id = ${c.id}`;
    if (existing.length > 0) {
      console.log(`  Conversation already exists: ${c.title?.substring(0, 50)} — skipping`);
      continue;
    }
    // Map old project_id: if it references default-project, use the user's default project
    let projId = c.project_id;
    if (projId === 'default-project') {
      const userDefault = sqliteProjects.find((p: any) => p.is_default === 1);
      if (userDefault) projId = userDefault.id;
    }
    await sql`INSERT INTO conversations (id, org_id, user_id, project_id, title, created_at, updated_at)
      VALUES (${c.id}, ${orgId}, ${USER_ID}, ${projId || ''}, ${c.title}, ${new Date(c.created_at)}, ${new Date(c.updated_at)})`;
    console.log(`  Migrated conversation: ${c.title?.substring(0, 60)}`);
  }

  // Step 4: Migrate messages
  console.log('\n--- Step 4: Messages ---');
  const convoIds = sqliteConvos.map((c: any) => c.id);
  let msgCount = 0;

  for (const convoId of convoIds) {
    const sqliteMessages = sqlite.prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC`
    ).all(convoId) as any[];

    for (const m of sqliteMessages) {
      // Check if already migrated (by conversation_id + content hash, since IDs are autoincrement and will differ)
      const existingMsgs = await sql`SELECT id FROM messages WHERE conversation_id = ${m.conversation_id} AND role = ${m.role} AND content = ${m.content} LIMIT 1`;
      if (existingMsgs.length > 0) {
        continue;
      }
      await sql`INSERT INTO messages (conversation_id, role, content, coach_key, mode, created_at)
        VALUES (${m.conversation_id}, ${m.role}, ${m.content}, ${m.coach_key}, ${m.mode}, ${new Date(m.created_at)})`;
      msgCount++;
    }
  }
  console.log(`  Migrated ${msgCount} messages`);

  // Step 5: Migrate message feedback
  console.log('\n--- Step 5: Feedback ---');
  const sqliteFeedback = sqlite.prepare(
    `SELECT * FROM message_feedback WHERE conversation_id IN (${convoIds.map(() => '?').join(',')})`
  ).all(...convoIds) as any[];

  for (const f of sqliteFeedback) {
    const existing = await sql`SELECT id FROM message_feedback WHERE id = ${f.id}`;
    if (existing.length > 0) {
      console.log(`  Feedback already exists: ${f.id} — skipping`);
      continue;
    }
    // Need to find the new message_id — match by conversation_id + content
    const origMsg = sqlite.prepare('SELECT * FROM messages WHERE id = ?').get(f.message_id) as any;
    if (!origMsg) {
      console.log(`  Skipping feedback ${f.id} — original message not found`);
      continue;
    }
    const newMsgRows = await sql`SELECT id FROM messages WHERE conversation_id = ${f.conversation_id} AND role = ${origMsg.role} AND content = ${origMsg.content} LIMIT 1`;
    if (newMsgRows.length === 0) {
      console.log(`  Skipping feedback ${f.id} — couldn't find migrated message`);
      continue;
    }
    await sql`INSERT INTO message_feedback (id, message_id, conversation_id, user_id, coach_key, mode, rating, comment, created_at)
      VALUES (${f.id}, ${newMsgRows[0].id}, ${f.conversation_id}, ${USER_ID}, ${f.coach_key}, ${f.mode}, ${f.rating}, ${f.comment}, ${new Date(f.created_at)})`;
    console.log(`  Migrated feedback: ${f.id}`);
  }

  // Step 6: Migrate review requests
  console.log('\n--- Step 6: Review Requests ---');
  const sqliteReviews = sqlite.prepare(
    `SELECT * FROM review_requests WHERE requester_user_id = ?`
  ).all(USER_ID) as any[];

  for (const r of sqliteReviews) {
    const existing = await sql`SELECT id FROM review_requests WHERE id = ${r.id}`;
    if (existing.length > 0) {
      console.log(`  Review already exists: ${r.id} — skipping`);
      continue;
    }
    await sql`INSERT INTO review_requests (id, conversation_id, message_id, requester_user_id, expert_email, expert_user_id, status, context_summary, question, access_token, expires_at, created_at, completed_at)
      VALUES (${r.id}, ${r.conversation_id}, ${r.message_id}, ${r.requester_user_id}, ${r.expert_email}, ${r.expert_user_id}, ${r.status}, ${r.context_summary}, ${r.question}, ${r.access_token}, ${new Date(r.expires_at)}, ${new Date(r.created_at)}, ${r.completed_at ? new Date(r.completed_at) : null})`;
    console.log(`  Migrated review request: ${r.id}`);
  }

  // Step 7: Migrate expert comments
  console.log('\n--- Step 7: Expert Comments ---');
  const reviewIds = sqliteReviews.map((r: any) => r.id);
  if (reviewIds.length > 0) {
    const sqliteComments = sqlite.prepare(
      `SELECT * FROM expert_comments WHERE review_request_id IN (${reviewIds.map(() => '?').join(',')})`
    ).all(...reviewIds) as any[];

    for (const c of sqliteComments) {
      const existing = await sql`SELECT id FROM expert_comments WHERE id = ${c.id}`;
      if (existing.length > 0) continue;
      await sql`INSERT INTO expert_comments (id, review_request_id, conversation_id, author_email, author_name, author_user_id, content, parent_message_id, created_at)
        VALUES (${c.id}, ${c.review_request_id}, ${c.conversation_id}, ${c.author_email}, ${c.author_name}, ${c.author_user_id}, ${c.content}, ${c.parent_message_id}, ${new Date(c.created_at)})`;
      console.log(`  Migrated comment: ${c.id}`);
    }
  }

  // Step 8: Migrate coach sessions
  console.log('\n--- Step 8: Coach Sessions ---');
  let sessionCount = 0;
  for (const convoId of convoIds) {
    const sqliteSessions = sqlite.prepare(
      `SELECT * FROM coach_sessions WHERE conversation_id = ?`
    ).all(convoId) as any[];

    for (const s of sqliteSessions) {
      const existing = await sql`SELECT conversation_id FROM coach_sessions WHERE conversation_id = ${s.conversation_id} AND coach_key = ${s.coach_key}`;
      if (existing.length > 0) continue;
      await sql`INSERT INTO coach_sessions (conversation_id, coach_key, session_id, user_id, created_at)
        VALUES (${s.conversation_id}, ${s.coach_key}, ${s.session_id}, ${USER_ID}, ${new Date(s.created_at)})`;
      sessionCount++;
    }
  }
  console.log(`  Migrated ${sessionCount} coach sessions`);

  console.log('\n✅ Migration complete!');

  sqlite.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
