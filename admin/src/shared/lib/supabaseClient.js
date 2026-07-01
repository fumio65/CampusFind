import { createClient } from '@supabase/supabase-js'

// Credentials are never hardcoded or sent to anyone else — fill them into
// .env.local (gitignored) using the values from your Supabase project's
// Settings -> API page. Vite only exposes vars prefixed with VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Copy .env.example to .env.local and fill in ' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your project\'s Settings -> API page.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
