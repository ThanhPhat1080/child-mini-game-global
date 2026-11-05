/** Where "sign in" goes: the play area when the parent came from there (`?from=play`), else Parent Admin (FS6). */
export type SignInPath = '/play/sign-in' | '/admin/sign-in';

export function signInPathFor(search: string): SignInPath {
  return new URLSearchParams(search).get('from') === 'play' ? '/play/sign-in' : '/admin/sign-in';
}
