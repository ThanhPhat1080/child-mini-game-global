import { redirect } from 'next/navigation';

/** The singleton settings page is gone (U4). A parent's details and children live on Profile (PR11). */
export default function SettingsRedirect() {
  redirect('/admin/profile');
}
