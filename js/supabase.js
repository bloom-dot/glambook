import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lcrrdwlnxmneqfzqediu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjcnJkd2xueG1uZXFmenFlZGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MDc5MTgsImV4cCI6MjA5NzI4MzkxOH0.vRxf7W_VaPEUUS7n-eswQVN4X25Z7KfEiRsxUPRA_qQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}
