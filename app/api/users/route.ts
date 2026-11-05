import { ROLES, getMyProfile, type Role } from '@/lib/auth/roles';
import { errorResponse, parseAccountInput, provisionAccount, readJson } from '@/lib/auth/accounts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

/** POST /api/users (U8): a Super Admin creates a parent or Super Admin account. */
export async function POST(request: Request): Promise<Response> {
  try {
    const me = await getMyProfile(await createSupabaseServerClient());
    if (!me) return errorResponse('unauthenticated');
    if (me.role !== 'super_admin') return errorResponse('forbidden');

    const body = await readJson(request);
    const input = body && parseAccountInput(body);
    if (!body || !input) return errorResponse('invalid_body');
    const role = body.role as Role;
    if (!ROLES.includes(role)) return errorResponse('invalid_body');

    const finalProfile: Record<string, unknown> =
      role === 'super_admin'
        ? { role: 'super_admin', display_name: input.displayName, policy_version_accepted: null, policy_accepted_at: null }
        : { display_name: input.displayName };

    const result = await provisionAccount(createSupabaseServiceClient(), input, finalProfile);
    if (!result.ok) return errorResponse(result.error);
    return Response.json({ userId: result.userId }, { status: 201 });
  } catch {
    return errorResponse('failed');
  }
}
