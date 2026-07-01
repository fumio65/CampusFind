import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

// Uses the SERVICE ROLE key (not anon) -- bypasses RLS since this trusted
// server writes `users` rows on the admin's behalf. Never expose this key
// to a browser bundle.
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to ' +
    '.env and fill in values from Settings -> API -> service_role (secret).'
  )
}

export const supabaseAdmin = createClient(supabaseUrl ?? '', supabaseServiceRoleKey ?? '', {
  auth: { autoRefreshToken: false, persistSession: false },
})