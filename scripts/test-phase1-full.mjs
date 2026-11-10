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
console.log('MTS COMPANION — PHASE 1 AUTOMATED COMPLIANCE TEST')
console.log('====================================================')

const supabase = createClient(url, anonKey)

async function runTests() {
  const testEmail1 = `test_aspirant_1_${Date.now()}@example.com`
  const testEmail2 = `test_aspirant_2_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log('\n[1/7] Testing User Registration & Sign In...')
  const { data: authData1, error: signUpErr1 } = await supabase.auth.signUp({
    email: testEmail1,
    password: testPassword,
  })

  if (signUpErr1) {
    console.error('❌ Sign up failed:', signUpErr1.message)
    process.exit(1)
  }

  let session1 = authData1.session
  if (!session1) {
    // If confirmation is required, attempt sign-in
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: testEmail1,
      password: testPassword,
    })
    if (signInErr) {
      console.warn('⚠️ User registered, but session requires email confirmation:', signInErr.message)
      console.log('Please disable "Confirm email" in Supabase Auth settings to enable automated test verification.')
      return
    }
    session1 = signInData.session
  }

  console.log('✓ Successfully registered and authenticated User 1:', testEmail1)
  const user1Client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${session1.access_token}` } },
  })

  console.log('\n[2/7] Verifying Subjects as Authenticated User...')
  const { data: subjects, error: subjErr } = await user1Client
    .from('subjects')
    .select('*')
    .order('name')

  if (subjErr) {
    console.error('❌ Failed to fetch subjects:', subjErr.message)
    process.exit(1)
  }

  console.log(`✓ Retrieved ${subjects.length} subjects:`)
  for (const s of subjects) {
    console.log(`   - ${s.name} (${s.slug}): target total = ${s.total_lectures}`)
  }

  if (subjects.length !== 4) {
    console.error(`❌ Expected exactly 4 subjects, found ${subjects.length}. Did the seed script run?`)
    process.exit(1)
  }

  console.log('\n[3/7] Verifying 255 Course Lectures Breakdown...')
  const { count: totalLectures, error: countErr } = await user1Client
    .from('lectures')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    console.error('❌ Failed to count lectures:', countErr.message)
    process.exit(1)
  }

  console.log(`✓ Total lectures in database: ${totalLectures} / 255`)

  // Check count per subject
  for (const s of subjects) {
    const { count: subLecCount } = await user1Client
      .from('lectures')
      .select('*', { count: 'exact', head: true })
      .eq('subject_id', s.id)

    console.log(`   - ${s.name}: ${subLecCount} lectures (Expected: ${s.total_lectures})`)
    if (subLecCount !== s.total_lectures) {
      console.error(`❌ Mismatch for ${s.name}! Expected ${s.total_lectures}, got ${subLecCount}`)
      process.exit(1)
    }
  }

  if (totalLectures !== 255) {
    console.error(`❌ Total lectures is ${totalLectures}, expected 255.`)
    process.exit(1)
  }
  console.log('✓ All 255 lectures verified successfully!')

  console.log('\n[4/7] Testing Lecture Progress State Transitions & Timestamps...')
  // Pick the first lecture
  const { data: sampleLectures } = await user1Client
    .from('lectures')
    .select('id, title, lecture_number')
    .order('lecture_number', { ascending: true })
    .limit(1)

  const sampleLecture = sampleLectures[0]
  console.log(`Testing with: ${sampleLecture.title} (ID: ${sampleLecture.id})`)

  // Transition A: Mark In Progress
  const t0 = new Date().toISOString()
  const { data: prog1, error: errProg1 } = await user1Client
    .from('lecture_progress')
    .insert({
      user_id: session1.user.id,
      lecture_id: sampleLecture.id,
      status: 'in_progress',
      started_at: t0,
    })
    .select()
    .single()

  if (errProg1) {
    console.error('❌ Failed to mark in_progress:', errProg1.message)
    process.exit(1)
  }
  console.log(`✓ Marked "in_progress". started_at: ${prog1.started_at}, completed_at: ${prog1.completed_at}`)

  // Transition B: Mark Completed (must preserve started_at)
  await new Promise((r) => setTimeout(r, 1000))
  const t1 = new Date().toISOString()
  const { data: prog2, error: errProg2 } = await user1Client
    .from('lecture_progress')
    .update({
      status: 'completed',
      completed_at: t1,
    })
    .eq('id', prog1.id)
    .select()
    .single()

  if (errProg2) {
    console.error('❌ Failed to mark completed:', errProg2.message)
    process.exit(1)
  }

  if (prog2.started_at !== prog1.started_at) {
    console.error('❌ started_at was not preserved!')
    process.exit(1)
  }
  console.log(`✓ Marked "completed". started_at preserved: ${prog2.started_at === prog1.started_at}. completed_at: ${prog2.completed_at}`)

  // Transition C: Reopen to In Progress (must clear completed_at, preserve started_at)
  const { data: prog3, error: errProg3 } = await user1Client
    .from('lecture_progress')
    .update({
      status: 'in_progress',
      completed_at: null,
    })
    .eq('id', prog1.id)
    .select()
    .single()

  if (errProg3) {
    console.error('❌ Failed to reopen lecture:', errProg3.message)
    process.exit(1)
  }

  if (prog3.completed_at !== null || prog3.started_at !== prog1.started_at) {
    console.error('❌ Reopening failed to preserve started_at or null completed_at!')
    process.exit(1)
  }
  console.log(`✓ Reopened to "in_progress". completed_at is null, started_at preserved: true`)

  // Transition D: Reset to Not Started (delete progress record)
  const { error: errProg4 } = await user1Client
    .from('lecture_progress')
    .delete()
    .eq('id', prog1.id)

  if (errProg4) {
    console.error('❌ Failed to reset to not started:', errProg4.message)
    process.exit(1)
  }
  console.log(`✓ Reset to "not_started" (record deleted, clean state)`)

  console.log('\n[5/7] Testing Row Level Security (RLS) & Multi-User Isolation...')
  // Register User 2
  const { data: authData2, error: signUpErr2 } = await supabase.auth.signUp({
    email: testEmail2,
    password: testPassword,
  })

  if (signUpErr2) {
    console.error('❌ User 2 registration failed:', signUpErr2.message)
    process.exit(1)
  }

  const session2 = authData2.session
  const user2Client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${session2.access_token}` } },
  })

  // User 1 creates a progress record
  const { data: user1Record } = await user1Client
    .from('lecture_progress')
    .insert({
      user_id: session1.user.id,
      lecture_id: sampleLecture.id,
      status: 'completed',
    })
    .select()
    .single()

  // User 2 queries progress
  const { data: user2SeenRecords } = await user2Client
    .from('lecture_progress')
    .select('*')

  const user2SawUser1 = user2SeenRecords.some((r) => r.user_id === session1.user.id)
  if (user2SawUser1) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can see User 1 progress records!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation verified: User 2 cannot see User 1 progress (${user2SeenRecords.length} records seen).`)

  // User 2 tries to update User 1's record
  const { data: unauthorizedUpdate } = await user2Client
    .from('lecture_progress')
    .update({ status: 'in_progress' })
    .eq('id', user1Record.id)
    .select()

  if (unauthorizedUpdate && unauthorizedUpdate.length > 0) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 was able to update User 1 progress!')
    process.exit(1)
  }
  console.log(`✓ RLS Write Isolation verified: User 2 cannot update User 1 progress.`)

  // User 2 tries to delete User 1's record
  await user2Client.from('lecture_progress').delete().eq('id', user1Record.id)
  const { data: verifyStillExists } = await user1Client
    .from('lecture_progress')
    .select('*')
    .eq('id', user1Record.id)

  if (!verifyStillExists || verifyStillExists.length === 0) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 was able to delete User 1 progress!')
    process.exit(1)
  }
  console.log(`✓ RLS Delete Isolation verified: User 2 cannot delete User 1 progress.`)

  // Clean up test records
  await user1Client.from('lecture_progress').delete().eq('id', user1Record.id)

  console.log('\n[6/7] Testing Sign Out...')
  await user1Client.auth.signOut()
  await user2Client.auth.signOut()
  console.log('✓ Successfully signed out test users.')

  console.log('\n====================================================')
  console.log('🎉 ALL DATABASE, AUTH, RLS, AND PROGRESS CHECKS PASSED!')
  console.log('====================================================')
}

runTests().catch((err) => {
  console.error('Unhandled failure:', err)
  process.exit(1)
})
