import { ForbiddenView } from '@/components/admin/ForbiddenView';

/** Shown to a signed-in child who opens /admin (U11). Open in the middleware, so it never redirects. */
export default function ForbiddenPage() {
  return <ForbiddenView />;
}
