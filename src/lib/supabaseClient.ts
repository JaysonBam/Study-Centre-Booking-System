import { createClient } from '@supabase/supabase-js'

declare const process: { env?: Record<string, string | undefined> } | undefined
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? process?.env?.SUPABASE_URL) as string
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? process?.env?.SUPABASE_KEY) as string

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
