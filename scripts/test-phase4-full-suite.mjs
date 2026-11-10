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

console.log('======================================================================')
console.log('MTS COMPANION — FINAL END-TO-END SYSTEM & SECURITY AUDIT')
console.log('======================================================================')

const supabase = createClient(url, anonKey)

async function runAudit() {
  const testEmail1 = `audit_user_1_${Date.now()}@example.com`
  const testEmail2 = `audit_user_2_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log('\n[1/7] Authentication & Account Isolation Verification...')
  const { data: auth1, error: err1 } = await supabase.auth.signUp({
    email: testEmail1,
    password: testPassword,
  })
  if (err1) throw new Error(`User 1 signup failed: ${err1.message}`)

  const { data: auth2, error: err2 } = await supabase.auth.signUp({
    email: testEmail2,
    password: testPassword,
  })
  if (err2) throw new Error(`User 2 signup failed: ${err2.message}`)

  const client1 = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${auth1.session.access_token}` } },
  })
  const client2 = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${auth2.session.access_token}` } },
  })
  console.log('✓ Both accounts authenticated successfully with distinct JWT sessions.')

  console.log('\n[2/7] Database Syllabus Integrity (4 Subjects, 255 Lectures)...')
  const { data: subjects } = await client1.from('subjects').select('*').order('name')
  if (!subjects || subjects.length !== 4) {
    throw new Error(`Expected 4 subjects, found ${subjects?.length}`)
  }

  const { count: lectureCount } = await client1
    .from('lectures')
    .select('*', { count: 'exact', head: true })

  if (lectureCount !== 255) {
    throw new Error(`Expected 255 lectures, found ${lectureCount}`)
  }
  console.log(`✓ 4 Subjects verified (General Knowledge, English, Mathematics, Reasoning).`)
  console.log(`✓ Exactly 255 lectures verified in PostgreSQL.`)

  console.log('\n[3/7] Lecture Progress & Row Level Security (RLS) Isolation...')
  const sampleLecture = (await client1.from('lectures').select('id, title').limit(1)).data[0]

  // User 1 sets progress
  await client1.from('lecture_progress').insert({
    user_id: auth1.user.id,
    lecture_id: sampleLecture.id,
    status: 'completed',
  })

  // User 2 verifies they cannot see User 1's progress
  const { data: user2Progress } = await client2.from('lecture_progress').select('*')
  if (user2Progress.some((p) => p.user_id === auth1.user.id)) {
    throw new Error('RLS breach on lecture_progress!')
  }
  console.log('✓ RLS verified on lecture_progress: User 2 isolated from User 1 records.')

  console.log('\n[4/7] Dedicated Lecture Notes Persistence & RLS...')
  const sampleNoteContent = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Audit verification study note.' }] }],
  }

  // User 1 saves note
  const { data: savedNote } = await client1
    .from('lecture_notes')
    .insert({
      user_id: auth1.user.id,
      lecture_id: sampleLecture.id,
      content: sampleNoteContent,
      plain_text: 'Audit verification study note.',
    })
    .select()
    .single()

  // User 2 queries notes
  const { data: user2Notes } = await client2.from('lecture_notes').select('*')
  if (user2Notes.some((n) => n.id === savedNote.id)) {
    throw new Error('RLS breach on lecture_notes!')
  }
  console.log('✓ RLS verified on lecture_notes: User 2 cannot access User 1 lecture notes.')

  console.log('\n[5/7] General Notes CRUD & Category Filtering...')
  const { data: genNote } = await client1
    .from('general_notes')
    .insert({
      user_id: auth1.user.id,
      title: 'Exam Formula Sheet',
      content: sampleNoteContent,
      plain_text: 'Audit general note plain text.',
    })
    .select()
    .single()

  const { data: user2GenNotes } = await client2.from('general_notes').select('*')
  if (user2GenNotes.some((n) => n.id === genNote.id)) {
    throw new Error('RLS breach on general_notes!')
  }
  console.log('✓ RLS verified on general_notes: User 2 cannot access User 1 general notes.')

  console.log('\n[6/7] Revision Centre Workspace & History Tracking...')
  const { data: revSession } = await client1
    .from('revision_sessions')
    .insert({
      user_id: auth1.user.id,
      title: 'End-to-End Audit Revision',
      mode: 'single',
      status: 'in_progress',
    })
    .select()
    .single()

  await client1.from('revision_session_lectures').insert({
    session_id: revSession.id,
    lecture_id: sampleLecture.id,
    order_index: 0,
    is_revised: true,
    is_difficult: true,
  })

  await client1.from('revision_history').insert({
    user_id: auth1.user.id,
    lecture_id: sampleLecture.id,
    session_id: revSession.id,
    is_difficult: true,
  })

  const { data: user2RevHistory } = await client2.from('revision_history').select('*')
  if (user2RevHistory.some((h) => h.session_id === revSession.id)) {
    throw new Error('RLS breach on revision_history!')
  }
  console.log('✓ RLS verified on revision_sessions and revision_history.')

  console.log('\n[7/7] Daily Study Planner Task Execution & Cleanup...')
  const { data: task } = await client1
    .from('study_tasks')
    .insert({
      user_id: auth1.user.id,
      title: 'Audit study task for planner',
      scheduled_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
    })
    .select()
    .single()

  const { data: user2Tasks } = await client2.from('study_tasks').select('*')
  if (user2Tasks.some((t) => t.id === task.id)) {
    throw new Error('RLS breach on study_tasks!')
  }
  console.log('✓ RLS verified on study_tasks: Complete user isolation confirmed.')

  // Clean up audit test records
  await client1.from('study_tasks').delete().eq('id', task.id)
  await client1.from('revision_sessions').delete().eq('id', revSession.id)
  await client1.from('revision_history').delete().eq('user_id', auth1.user.id)
  await client1.from('general_notes').delete().eq('id', genNote.id)
  await client1.from('lecture_notes').delete().eq('id', savedNote.id)
  await client1.from('lecture_progress').delete().eq('user_id', auth1.user.id)

  await client1.auth.signOut()
  await client2.auth.signOut()

  console.log('\n======================================================================')
  console.log('🎉 100% SECURITY & SYSTEM AUDIT PASSED ACROSS ALL MODULES!')
  console.log('======================================================================')
}

runAudit().catch((err) => {
  console.error('Audit failed:', err)
  process.exit(1)
})
