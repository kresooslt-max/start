import { createClient } from '@/lib/supabase/server';
export async function requireUser(){const s=await createClient();const {data:{user},error}=await s.auth.getUser();if(error||!user)throw new Error('UNAUTHORIZED');return user}
