import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yoffjgneldohabfzarbn.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZmZqZ25lbGRvaGFiZnphcmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNDM5NTYsImV4cCI6MjEwOTkxOTk1Nn0.7yGi_T0vx5TcZQn02o_-27ti6oxERLrY0M-qEvqC9b0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
