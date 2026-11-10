import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...rest] = trimmed.split('=')
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim()
      }
    }
  })
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('====================================================')
console.log('MTS COMPANION — PHASE 3 REVISION & PLANNER TEST')
console.log('====================================================')

const supabase = createClient(url, anonKey)

async function runTests() {
  const testEmail1 = `aspirant_p3_1_${Date.now()}@example.com`
  const testEmail2 = `aspirant_p3_2_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log('\n[1/6] Registering User 1 & User 2 for Phase 3 Testing...')
  const { data: auth1, error: err1 } = await supabase.auth.signUp({
    email: testEmail1,
    password: testPassword,
  })
  if (err1) {
    console.error('❌ Sign up 1 failed:', err1.message)
    process.exit(1)
  }

  const { data: auth2, error: err2 } = await supabase.auth.signUp({
    email: testEmail2,
    password: testPassword,
  })
  if (err2) {
    console.error('❌ Sign up 2 failed:', err2.message)
    process.exit(1)
  }

  const client1 = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${auth1.session.access_token}` } },
  })
  const client2 = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${auth2.session.access_token}` } },
  })
  console.log('✓ Successfully authenticated test users.')

  // Fetch sample lectures
  const { data: lectures } = await client1
    .from('lectures')
    .select('id, title, subject_id, lecture_number')
    .order('lecture_number', { ascending: true })
    .limit(5)

  if (!lectures || lectures.length < 5) {
    console.error('❌ Could not fetch 5 sample lectures.')
    process.exit(1)
  }

  console.log('\n[2/6] Testing Revision Session Creation (Range Mode: 5 Lectures)...')
  const { data: session, error: sessErr } = await client1
    .from('revision_sessions')
    .insert({
      user_id: auth1.user.id,
      title: 'GK Rapid Revision: Lectures 001–005',
      subject_id: lectures[0].subject_id,
      mode: 'range',
      status: 'in_progress',
    })
    .select()
    .single()

  if (sessErr) {
    console.error('❌ Failed to create revision session:', sessErr.message)
    console.error('Did you execute 003_revision_planner_schema.sql in the Supabase SQL editor?')
    process.exit(1)
  }
  console.log(`✓ Created revision session: "${session.title}" (ID: ${session.id})`)

  // Associate the 5 lectures
  const sessionLectures = lectures.map((l, idx) => ({
    session_id: session.id,
    lecture_id: l.id,
    order_index: idx,
    is_revised: false,
    is_difficult: false,
    needs_re_revision: false,
  }))

  const { error: sessLecErr } = await client1
    .from('revision_session_lectures')
    .insert(sessionLectures)

  if (sessLecErr) {
    console.error('❌ Failed to associate session lectures:', sessLecErr.message)
    process.exit(1)
  }
  console.log(`✓ Associated ${sessionLectures.length} lectures to the session.`)

  console.log('\n[3/6] Testing Workspace Revision Feedback & History Logging...')
  // Lecture 1: Normal revision
  const nowIso = new Date().toISOString()
  await client1
    .from('revision_session_lectures')
    .update({ is_revised: true, revised_at: nowIso })
    .eq('session_id', session.id)
    .eq('lecture_id', lectures[0].id)

  await client1.from('revision_history').insert({
    user_id: auth1.user.id,
    lecture_id: lectures[0].id,
    session_id: session.id,
    revised_at: nowIso,
  })
  console.log(`✓ Marked Lecture 1 as revised.`)

  // Lecture 2: Mark Difficult
  await client1
    .from('revision_session_lectures')
    .update({ is_revised: true, is_difficult: true, revised_at: nowIso })
    .eq('session_id', session.id)
    .eq('lecture_id', lectures[1].id)

  await client1.from('revision_history').insert({
    user_id: auth1.user.id,
    lecture_id: lectures[1].id,
    session_id: session.id,
    revised_at: nowIso,
    is_difficult: true,
  })
  console.log(`✓ Marked Lecture 2 as revised and flagged as DIFFICULT.`)

  // Lecture 3: Mark Needs Re-revision with target date
  const targetDate = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10)
  await client1
    .from('revision_session_lectures')
    .update({ is_revised: true, needs_re_revision: true, revised_at: nowIso })
    .eq('session_id', session.id)
    .eq('lecture_id', lectures[2].id)

  await client1.from('revision_history').insert({
    user_id: auth1.user.id,
    lecture_id: lectures[2].id,
    session_id: session.id,
    revised_at: nowIso,
    needs_re_revision: true,
    next_revision_date: targetDate,
  })
  console.log(`✓ Marked Lecture 3 for RE-REVISION with target date: ${targetDate}.`)

  console.log('\n[4/6] Testing Row Level Security on Revision Centre...')
  // User 2 queries revision sessions
  const { data: user2Sessions } = await client2.from('revision_sessions').select('*')
  if (user2Sessions && user2Sessions.some((s) => s.id === session.id)) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can view User 1 revision sessions!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation: User 2 sees 0 of User 1's revision sessions.`)

  // User 2 queries revision history
  const { data: user2History } = await client2.from('revision_history').select('*')
  if (user2History && user2History.some((h) => h.session_id === session.id)) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can view User 1 revision history!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation: User 2 sees 0 of User 1's revision history.`)

  // User 2 attempts to delete User 1's revision session
  await client2.from('revision_sessions').delete().eq('id', session.id)
  const { data: verifySessionStillExists } = await client1
    .from('revision_sessions')
    .select('*')
    .eq('id', session.id)

  if (!verifySessionStillExists || verifySessionStillExists.length === 0) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 was able to delete User 1 revision session!')
    process.exit(1)
  }
  console.log('✓ RLS Delete Isolation: User 2 cannot delete User 1 revision session.')

  console.log('\n[5/6] Testing Daily Study Planner (Task Creation, Toggle, RLS)...')
  const todayStr = new Date().toISOString().slice(0, 10)
  const { data: task, error: taskErr } = await client1
    .from('study_tasks')
    .insert({
      user_id: auth1.user.id,
      title: 'Complete 2 GK Lectures & practice 15 Reasoning questions',
      subject_id: lectures[0].subject_id,
      scheduled_date: todayStr,
      status: 'pending',
    })
    .select()
    .single()

  if (taskErr) {
    console.error('❌ Failed to create study task:', taskErr.message)
    process.exit(1)
  }
  console.log(`✓ Created study task for ${todayStr}: "${task.title}"`)

  // Toggle completion
  const { data: completedTask, error: toggleErr } = await client1
    .from('study_tasks')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', task.id)
    .select()
    .single()

  if (toggleErr || completedTask.status !== 'completed') {
    console.error('❌ Failed to toggle task completion:', toggleErr?.message)
    process.exit(1)
  }
  console.log(`✓ Marked task completed. completed_at: ${completedTask.completed_at}`)

  // User 2 queries study tasks
  const { data: user2Tasks } = await client2.from('study_tasks').select('*')
  if (user2Tasks && user2Tasks.some((t) => t.id === task.id)) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can view User 1 study tasks!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation: User 2 sees 0 of User 1's study tasks.`)

  console.log('\n[6/6] Cleanup & Sign Out...')
  await client1.from('study_tasks').delete().eq('id', task.id)
  await client1.from('revision_sessions').delete().eq('id', session.id)
  await client1.from('revision_history').delete().eq('user_id', auth1.user.id)
  await client1.auth.signOut()
  await client2.auth.signOut()
  console.log('✓ Test cleanup complete.')

  console.log('\n====================================================')
  console.log('🎉 ALL PHASE 3 REVISION & PLANNER TESTS PASSED!')
  console.log('====================================================')
}

runTests().catch((err) => {
  console.error('Unhandled failure:', err)
  process.exit(1)
})
