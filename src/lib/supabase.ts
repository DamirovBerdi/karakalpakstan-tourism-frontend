import { createClient } from '@supabase/supabase-js';
import { BACKEND_URL } from './api';

const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0aGRmbHRnZHZmamxsZ3l1dG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2Mjk1OTMsImV4cCI6MjEwNTIwNTU5M30.6iww9peFVE91jeI5wegtOAoAlhAwH2hPeEk-HfSrOdk';

// Route Supabase REST/Auth/Storage through backend proxy so Supabase domain is 100% hidden in DevTools
const backendProxyUrl = `${BACKEND_URL.replace(/\/$/, '')}/supabase`;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || DEFAULT_ANON_KEY;

export const supabase = createClient(backendProxyUrl, supabaseAnonKey);
