import ParentDetail from '@/components/admin/ParentDetail';

/** One parent (N14): ban or restore, storage quota, the children, and the levels. The page is a thin wrapper. */
export default async function ParentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParentDetail id={id} />;
}
