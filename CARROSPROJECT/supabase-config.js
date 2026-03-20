
const SUPABASE_URL = 'https://dvkoutrdmhuindbcfaiy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2a291dHJkbWh1aW5kYmNmYWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjIwMzgsImV4cCI6MjA4OTQzODAzOH0.fx9TOt548Aj3c2Sa_kG5hKRVWohIH0sT74bhBF1icmY';

// Inicializa o cliente Supabase
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
