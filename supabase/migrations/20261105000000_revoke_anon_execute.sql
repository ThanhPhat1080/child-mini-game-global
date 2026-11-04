-- Supabase grants EXECUTE on new public functions to anon and authenticated directly, so the
-- earlier `revoke ... from public` did not remove anon's access. Signed-out visitors need none of
-- these (every policy that uses them is `to authenticated`); the write functions also check the
-- caller themselves.
revoke execute on function
  public.assert_super_admin(),
  public.ban_parent(uuid, text, text),
  public.can_read_content(uuid, public.visibility, boolean),
  public.can_write_content(uuid, public.visibility),
  public.can_write_media(text),
  public.current_role(),
  public.delete_item(text, uuid),
  public.is_banned(uuid),
  public.media_in_use(text),
  public.owner_scope(),
  public.request_edit(text, uuid, text),
  public.review_approve(text, uuid),
  public.review_reject(text, uuid, text),
  public.set_quota(uuid, bigint),
  public.share_item(text, uuid),
  public.storage_used(uuid),
  public.unban_parent(uuid),
  public.unpublish_item(text, uuid)
from anon;
