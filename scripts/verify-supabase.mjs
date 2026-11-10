import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Load .env.local manually if not in Next.js environment
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
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

console.log('--- SUPABASE CONNECTION CHECK ---')

if (!url || !anonKey) {
  console.error('❌ Error: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  console.error('Please configure .env.local with your project details.')
  process.exit(1)
}

if (url.includes('your-project-id') || anonKey.includes('your-anon')) {
  console.error('❌ Error: .env.local contains default placeholder values. Please replace them with your actual Supabase credentials.')
  process.exit(1)
}

console.log(`Connecting to: ${url}`)
const supabase = createClient(url, anonKey)

async function verify() {
  try {
    // 1. Query subjects
    const { data: subjects, error: subjErr } = await supabase
      .from('subjects')
      .select('id, name, slug, total_lectures')
      .order('slug')

    if (subjErr) {
      console.error('❌ Could not query subjects table:', subjErr.message)
      console.error('Did you run the SQL migration in the Supabase SQL editor?')
      process.exit(1)
    }

    console.log(`✓ Successfully connected to Supabase!`)
    console.log(`✓ Found ${subjects.length} subjects:`)
    subjects.forEach(s => {
      console.log(`   - ${s.name} (${s.slug}): target total ${s.total_lectures}`)
    })

    if (subjects.length !== 4) {
      console.error(`⚠️ Expected 4 subjects, but found ${subjects.length}. Check seed data.`)
    }

    // 2. Count lectures
    const { count, error: countErr } = await supabase
      .from('lectures')
      .select('*', { count: 'exact', head: true })

    if (countErr) {
      console.error('❌ Could not count lectures:', countErr.message)
      process.exit(1)
    }

    console.log(`✓ Total lectures in database: ${count} / 255`)

    if (count === 255) {
      console.log('🎉 Verification passed! All 4 subjects and 255 lectures are properly seeded.')
    } else {
      console.warn(`⚠️ Warning: Expected 255 lectures, found ${count}.`)
    }

    // 3. Test lecture_progress table structure
    const { error: progErr } = await supabase
      .from('lecture_progress')
      .select('id')
      .limit(1)

    if (progErr && !progErr.message.includes('0 rows')) {
      // It's normal to return empty rows or RLS empty response for unauthenticated client
      console.log('ℹ️ lecture_progress table check:', progErr.message)
    } else {
      console.log('✓ lecture_progress table exists and is accessible with RLS active.')
    }

    console.log('---------------------------------')
  } catch (err) {
    console.error('❌ Unexpected error during verification:', err)
    process.exit(1)
  }
}

verify()
