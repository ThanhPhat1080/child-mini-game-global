import { redirect } from 'next/navigation';

/** The singleton settings page is gone (U4); a child's settings live on the Children page. */
export default function SettingsRedirect() {
  redirect('/admin/children');
}
