import { adminAccess, getMyProfile } from '@/lib/auth/roles';
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

/**
 * POST /api/children (U8): a parent creates one of their (at most 5) child accounts. A Super Admin may
 * do it for any parent by passing `parentId`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const me = await getMyProfile(await createSupabaseServerClient());
    const access = adminAccess(me);
    if (!me || access === 'signin') return errorResponse('unauthenticated');
    if (access !== 'ok') return errorResponse('forbidden');

    const body = await readJson(request);
    const input = body && parseAccountInput(body);
    if (!body || !input) return errorResponse('invalid_body');

    const service = createSupabaseServiceClient();
    let parentId: string;
    if (me.role === 'super_admin') {
      if (!isUuid(body.parentId)) return errorResponse('invalid_body');
      if (!(await isParent(service, body.parentId))) return errorResponse('invalid_parent');
      parentId = body.parentId;
    } else {
      parentId = me.user_id;
    }

    const count = await countChildren(service, parentId);
    if (count == null) return errorResponse('failed');
    if (count >= MAX_CHILDREN) return errorResponse('child_limit');

    const result = await provisionAccount(service, input, {
      role: 'child',
      parent_id: parentId,
      display_name: input.displayName,
      policy_version_accepted: null,
      policy_accepted_at: null,
    });
    if (!result.ok) return errorResponse(result.error);
    return Response.json({ childId: result.userId }, { status: 201 });
  } catch {
    return errorResponse('failed');
  }
}
