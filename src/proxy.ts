import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const s = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => req.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => req.cookies.set(name, value)); response = NextResponse.next({ request: req }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data } = await s.auth.getClaims();
  const user = data?.claims;
  const protectedPaths = ['/dashboard','/products','/research','/analytics','/photos','/settings'];
  if (protectedPaths.some(p => req.nextUrl.pathname.startsWith(p)) && !user) { const u = req.nextUrl.clone(); u.pathname = '/login'; return NextResponse.redirect(u); }
  if (req.nextUrl.pathname === '/login' && user) { const u = req.nextUrl.clone(); u.pathname = '/dashboard'; return NextResponse.redirect(u); }
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };