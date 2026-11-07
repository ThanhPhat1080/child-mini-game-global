import { redirect } from 'next/navigation';

/** The Children page is part of Profile now (PR11): the old route sends the parent there. */
export default function ChildrenRoute() {
  redirect('/admin/profile');
}
