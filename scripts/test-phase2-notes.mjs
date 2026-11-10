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
console.log('MTS COMPANION — PHASE 2 NOTES & RLS VERIFICATION')
console.log('====================================================')

const supabase = createClient(url, anonKey)

async function runTests() {
  const testEmail1 = `aspirant_notes_1_${Date.now()}@example.com`
  const testEmail2 = `aspirant_notes_2_${Date.now()}@example.com`
  const testPassword = 'Password123!'

  console.log('\n[1/6] Registering User 1 & User 2 for Notes Testing...')
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
  console.log('✓ Successfully authenticated both test users.')

  // Fetch sample lecture and subject
  const { data: lectures } = await client1
    .from('lectures')
    .select('id, title, subject_id')
    .limit(1)

  const sampleLecture = lectures[0]
  console.log(`Using sample lecture: ${sampleLecture.title} (ID: ${sampleLecture.id})`)

  console.log('\n[2/6] Testing Lecture Notes Persistence & Debounced Upsert...')
  const sampleContentV1 = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Important GK Concepts' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Article 370 history and JK Reorganization Act 2019.' }],
      },
    ],
  }
  const plainTextV1 = 'Important GK Concepts\nArticle 370 history and JK Reorganization Act 2019.'

  // Insert initial note
  const { data: note1, error: insertNoteErr } = await client1
    .from('lecture_notes')
    .upsert({
      user_id: auth1.user.id,
      lecture_id: sampleLecture.id,
      content: sampleContentV1,
      plain_text: plainTextV1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lecture_id' })
    .select()
    .single()

  if (insertNoteErr) {
    console.error('❌ Failed to save lecture note:', insertNoteErr.message)
    console.error('Did you execute 002_notes_schema.sql in the Supabase SQL editor?')
    process.exit(1)
  }
  console.log('✓ Saved lecture note. ID:', note1.id)

  // Update same note (simulate autosave editing)
  const sampleContentV2 = {
    ...sampleContentV1,
    content: [
      ...sampleContentV1.content,
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Additional key facts: 20 districts, high court located in Srinagar & Jammu.' }],
      },
    ],
  }
  const plainTextV2 = plainTextV1 + '\nAdditional key facts: 20 districts, high court located in Srinagar & Jammu.'

  const { data: note2, error: updateNoteErr } = await client1
    .from('lecture_notes')
    .upsert({
      user_id: auth1.user.id,
      lecture_id: sampleLecture.id,
      content: sampleContentV2,
      plain_text: plainTextV2,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lecture_id' })
    .select()
    .single()

  if (updateNoteErr) {
    console.error('❌ Failed to update lecture note:', updateNoteErr.message)
    process.exit(1)
  }

  // Ensure same row was updated, NOT duplicated
  if (note2.id !== note1.id) {
    console.error('❌ Duplicate lecture note created instead of updating existing row!')
    process.exit(1)
  }
  console.log('✓ Upsert preserved single note record per (user_id, lecture_id) without duplicate.')

  console.log('\n[3/6] Testing Row Level Security on Lecture Notes...')
  // User 2 queries lecture notes
  const { data: user2Notes } = await client2
    .from('lecture_notes')
    .select('*')

  const user2SawUser1Note = user2Notes.some((n) => n.id === note1.id)
  if (user2SawUser1Note) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can view User 1 lecture note!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation verified for Lecture Notes: User 2 saw ${user2Notes.length} notes.`)

  // User 2 attempts to delete User 1's note
  await client2.from('lecture_notes').delete().eq('id', note1.id)
  const { data: noteStillExists } = await client1
    .from('lecture_notes')
    .select('*')
    .eq('id', note1.id)

  if (!noteStillExists || noteStillExists.length === 0) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 deleted User 1 lecture note!')
    process.exit(1)
  }
  console.log('✓ RLS Delete Isolation verified for Lecture Notes.')

  console.log('\n[4/6] Testing General Notes Module (Categorized & Uncategorized)...')
  // 1. Create Categorized General Note
  const { data: genNote1, error: genErr1 } = await client1
    .from('general_notes')
    .insert({
      user_id: auth1.user.id,
      subject_id: sampleLecture.subject_id,
      title: 'JK Geography Fast Facts',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important rivers: Jhelum, Chenab, Ravi, Tawi.' }] }] },
      plain_text: 'Important rivers: Jhelum, Chenab, Ravi, Tawi.',
    })
    .select()
    .single()

  if (genErr1) {
    console.error('❌ Failed to create categorized general note:', genErr1.message)
    process.exit(1)
  }
  console.log('✓ Created categorized general note:', genNote1.title)

  // 2. Create Uncategorized General Note
  const { data: genNote2, error: genErr2 } = await client1
    .from('general_notes')
    .insert({
      user_id: auth1.user.id,
      subject_id: null,
      title: 'General Exam Strategy & Timetable',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dedicate 3 hours daily to GK, 1 hour to Reasoning, 1 hour to Math.' }] }] },
      plain_text: 'Dedicate 3 hours daily to GK, 1 hour to Reasoning, 1 hour to Math.',
    })
    .select()
    .single()

  if (genErr2) {
    console.error('❌ Failed to create uncategorized general note:', genErr2.message)
    process.exit(1)
  }
  console.log('✓ Created uncategorized general note:', genNote2.title)

  console.log('\n[5/6] Testing Row Level Security on General Notes...')
  // User 2 queries general notes
  const { data: user2GenNotes } = await client2
    .from('general_notes')
    .select('*')

  const user2SawGen1 = user2GenNotes.some((n) => n.id === genNote1.id || n.id === genNote2.id)
  if (user2SawGen1) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 can view User 1 general notes!')
    process.exit(1)
  }
  console.log(`✓ RLS Read Isolation verified for General Notes: User 2 saw ${user2GenNotes.length} notes.`)

  // User 2 attempts to edit User 1's note
  const { data: unauthorizedGenUpdate } = await client2
    .from('general_notes')
    .update({ title: 'Hacked Title' })
    .eq('id', genNote1.id)
    .select()

  if (unauthorizedGenUpdate && unauthorizedGenUpdate.length > 0) {
    console.error('❌ CRITICAL SECURITY FLAW: User 2 was able to update User 1 general note!')
    process.exit(1)
  }
  console.log('✓ RLS Write Isolation verified for General Notes.')

  console.log('\n[6/6] Testing Note Deletion & Cleanup...')
  const { error: delGenErr } = await client1
    .from('general_notes')
    .delete()
    .eq('id', genNote1.id)

  if (delGenErr) {
    console.error('❌ Failed to delete general note:', delGenErr.message)
    process.exit(1)
  }
  console.log('✓ Successfully deleted general note.')

  await client1.from('general_notes').delete().eq('id', genNote2.id)
  await client1.from('lecture_notes').delete().eq('id', note1.id)
  console.log('✓ Cleanup of test notes complete.')

  console.log('\n====================================================')
  console.log('🎉 ALL PHASE 2 NOTES & RLS TESTS PASSED SUCCESSFULLY!')
  console.log('====================================================')
}

runTests().catch((err) => {
  console.error('Unhandled failure:', err)
  process.exit(1)
})
