/** Content-policy ban reasons (spec 5.1). One shared list for the ban dialog, suspended screen and carousel. */
export type BanReason =
  | 'inaccurate'
  | 'sexual'
  | 'violent_scary'
  | 'political'
  | 'hate'
  | 'off_target'
  | 'personal_or_copyright'
  | 'other';

export const BAN_REASONS: readonly { code: BanReason; label: string; en: string }[] = [
  { code: 'inaccurate', label: 'Nội dung sai hoặc gây hiểu nhầm', en: 'Wrong or misleading questions, answers or translations.' },
  { code: 'sexual', label: 'Nội dung tình dục hoặc người lớn', en: 'Sexual or adult content, including suggestive images.' },
  { code: 'violent_scary', label: 'Bạo lực, máu me hoặc gây sợ hãi', en: 'Violence, gore, weapons, or scary images or sounds.' },
  { code: 'political', label: 'Nội dung chính trị hoặc sai lệch', en: 'Political, propaganda or misleading content against the spirit of the app.' },
  { code: 'hate', label: 'Nội dung thù ghét hoặc bắt nạt', en: 'Hateful, discriminatory or bullying content.' },
  { code: 'off_target', label: 'Không liên quan đến học tiếng Anh cho trẻ nhỏ', en: 'Not about learning English for young children (ads, spam, links).' },
  { code: 'personal_or_copyright', label: 'Thông tin cá nhân hoặc vi phạm bản quyền', en: 'Photos of people without consent, personal data, or material you have no right to use.' },
  { code: 'other', label: 'Lý do khác', en: 'Anything else; the note explains it.' },
];
