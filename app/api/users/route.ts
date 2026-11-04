import { ROLES, getMyProfile, type Role } from '@/lib/auth/roles';
import {
  MAX_CHILDREN,
  countChildren,
  errorResponse,
  isParent,
  isUuid,
  parseAccountInput,
  provisionAccount,
  readJson,
} from '@/lib/auth/accounts';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

/** POST /api/users (U8): a Super Admin creates a parent, child or Super Admin account. */
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

    const service = createSupabaseServiceClient();
    let finalProfile: Record<string, unknown>;
    if (role === 'child') {
      if (!isUuid(body.parentId)) return errorResponse('invalid_body');
      const parentId = body.parentId;
      if (!(await isParent(service, parentId))) return errorResponse('invalid_parent');
      const count = await countChildren(service, parentId);
      if (count == null) return errorResponse('failed');
      if (count >= MAX_CHILDREN) return errorResponse('child_limit');
      finalProfile = {
        role: 'child',
        parent_id: parentId,
        display_name: input.displayName,
        policy_version_accepted: null,
        policy_accepted_at: null,
      };
    } else if (role === 'super_admin') {
      finalProfile = {
        role: 'super_admin',
        display_name: input.displayName,
        policy_version_accepted: null,
        policy_accepted_at: null,
      };
    } else {
      finalProfile = { display_name: input.displayName };
    }

    const result = await provisionAccount(service, input, finalProfile);
    if (!result.ok) return errorResponse(result.error);
    return Response.json({ userId: result.userId }, { status: 201 });
  } catch {
    return errorResponse('failed');
  }
}
