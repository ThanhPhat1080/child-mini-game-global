import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/media/refs', () => ({ referencedPaths: async () => new Set<string>() })); // nothing else uses these files

const upload = vi.fn();
const remove = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'me' } } } }) },
    storage: { from: () => ({ upload, remove, getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }) }) },
  }),
}));

import { addPending, clearPending, commitPendingMedia, materializeSvg, mediaUrl, pendingName } from '@/lib/media';
import { mapSetMedia } from '@/lib/mediaPaths';

const file = (name: string, type = 'image/svg+xml', size = 10) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const blank = () => ({ cover: null as string | null, qs: [{ qimg: null as string | null, voice: null as string | null, imgs: [null, null, null] as (string | null)[] }] });

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  remove.mockReset().mockResolvedValue({ error: null });
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => clearPending());

describe('picking a file', () => {
  it('only previews it: nothing is uploaded', () => {
    const t = addPending(file('apple.svg'));
    expect(t.startsWith('pending:')).toBe(true);
    expect(mediaUrl(t)).toBe('blob:preview-1');
    expect(pendingName(t)).toBe('apple.svg');
    expect(upload).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('rejects an image over 2 MB right away', () => {
    expect(() => addPending(file('big.png', 'image/png', 3 * 1024 * 1024))).toThrow(/2 MB/);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('clearPending frees the preview', () => {
    const t = addPending(file('a.svg'));
    clearPending();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(mediaUrl(t)).toBeNull();
  });
});

describe('commitPendingMedia (Save)', () => {
  it('uploads each picked file once, into the right folder, and swaps in real paths', async () => {
    const d = blank();
    d.cover = addPending(file('cover.svg'));
    d.qs[0].imgs[0] = addPending(file('a1.svg'));
    d.qs[0].imgs[1] = 'answers/old.png'; // already saved: untouched
    d.qs[0].voice = addPending(file('v.mp3', 'audio/mpeg'));
    const { d: out, uploaded } = await commitPendingMedia(d);
    expect(upload).toHaveBeenCalledTimes(3);
    const folders = upload.mock.calls.map((c) => (c[0] as string).split('/')[1]).sort();
    expect(folders).toEqual(['answers', 'covers', 'voices']);
    expect(uploaded).toHaveLength(3);
    expect(out.cover).toMatch(/^me\/covers\/[A-Za-z0-9-]*-[0-9a-z]{13}\.svg$/);
    expect(out.qs[0].imgs[0]).toMatch(/^me\/answers\/[A-Za-z0-9-]*-[0-9a-z]{13}\.svg$/);
    expect(out.qs[0].imgs[1]).toBe('answers/old.png');
    expect(out.qs[0].voice).toMatch(/^me\/voices\/[A-Za-z0-9-]*-[0-9a-z]{13}\.mp3$/);
    expect(JSON.stringify(out)).not.toContain('pending:');
  });

  it('uploads nothing when there are no picks', async () => {
    const d = blank();
    d.cover = 'covers/1.png';
    const r = await commitPendingMedia(d);
    expect(upload).not.toHaveBeenCalled();
    expect(r.uploaded).toEqual([]);
    expect(r.d).toEqual(d);
  });

  it('a picture replaced before Save is never uploaded', async () => {
    const d = blank();
    addPending(file('first.svg'));
    d.cover = addPending(file('second.svg'));
    await commitPendingMedia(d);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][1].name).toBe('second.svg');
  });

  it('rolls back earlier uploads and throws when one fails', async () => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: 'boom' } });
    const d = blank();
    d.cover = addPending(file('c.svg'));
    d.qs[0].qimg = addPending(file('q.svg'));
    await expect(commitPendingMedia(d)).rejects.toThrow('boom');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0][0]).toHaveLength(1);
  });

  it('fails clearly when a picked file was discarded', async () => {
    const d = blank();
    d.cover = addPending(file('c.svg'));
    clearPending();
    await expect(commitPendingMedia(d)).rejects.toThrow(/choose it again/);
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('SVG code from Quick import: one file per distinct drawing', () => {
  const A = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 8\"><rect width=\"8\" height=\"8\"/></svg>";
  const B = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 8 8\"><circle r=\"4\"/></svg>";
  const qs = (imgs: (string | null)[], qimg: string | null = null) => [{ qimg, voice: null as string | null, imgs }];

  it('gives identical SVG one placeholder, and different SVG its own', () => {
    const [q] = materializeSvg(qs([A, A, B], A));
    expect(q.imgs[0]).toMatch(/^pending:/);
    expect(q.imgs[1]).toBe(q.imgs[0]);
    expect(q.qimg).toBe(q.imgs[0]);
    expect(q.imgs[2]).not.toBe(q.imgs[0]);
    expect(upload).not.toHaveBeenCalled();
  });

  it('reuses the placeholder across separate imports', () => {
    const [a] = materializeSvg(qs([A, null, null]));
    const [b] = materializeSvg(qs([null, A, null]));
    expect(b.imgs[1]).toBe(a.imgs[0]);
  });

  it('uploads three identical answers (and the question image) as ONE file', async () => {
    const [q] = materializeSvg(qs([A, A, A], A));
    const { d, uploaded } = await commitPendingMedia({ cover: null as string | null, qs: [q] });
    expect(upload).toHaveBeenCalledTimes(1);
    expect(uploaded).toHaveLength(1);
    const path = uploaded[0];
    expect(path).toMatch(/\.svg$/);
    expect(d.qs[0].imgs).toEqual([path, path, path]);
    expect(d.qs[0].qimg).toBe(path);
  });

  it('uploads two different drawings as two files', async () => {
    const [q] = materializeSvg(qs([A, B, A]));
    const { d } = await commitPendingMedia({ cover: null as string | null, qs: [q] });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(d.qs[0].imgs[0]).toBe(d.qs[0].imgs[2]);
    expect(d.qs[0].imgs[0]).not.toBe(d.qs[0].imgs[1]);
  });

  it('forgets the placeholder once pending files are cleared', () => {
    const [a] = materializeSvg(qs([A, null, null]));
    clearPending();
    const [b] = materializeSvg(qs([A, null, null]));
    expect(b.imgs[0]).not.toBe(a.imgs[0]);
  });

  it('leaves links, saved paths and blanks alone', () => {
    const [q] = materializeSvg(qs(['https://x.test/a.svg', 'answers/1.svg', null]));
    expect(q.imgs).toEqual(['https://x.test/a.svg', 'answers/1.svg', null]);
  });
});

describe('mapSetMedia', () => {
  it('maps cover, question image, voice and answers with their folders', () => {
    const seen: string[] = [];
    mapSetMedia({ cover: 'c', qs: [{ qimg: 'q', voice: 'v', imgs: ['a', null] }] }, (p, f) => { seen.push(`${f}:${p}`); return p; });
    expect(seen).toEqual(['covers:c', 'questions:q', 'voices:v', 'answers:a', 'answers:null']);
  });
});

describe('owner folders and sound limit (Q1, Q3, Q5)', () => {
  it('upload path starts with the user id', async () => {
    const d = blank();
    d.cover = addPending(file('cover.svg'));
    const { d: out } = await commitPendingMedia(d);
    expect(out.cover?.startsWith('me/')).toBe(true);
    expect(upload.mock.calls[0][0]).toMatch(/^me\/covers\//);
  });

  it('a sound over 2 MB is refused with "Sound must be 2 MB or smaller."', () => {
    expect(() => addPending(file('long.mp3', 'audio/mpeg', 3 * 1024 * 1024))).toThrow('Sound must be 2 MB or smaller.');
    expect(() => addPending(file('ok.mp3', 'audio/mpeg', 2 * 1024 * 1024))).not.toThrow();
  });

  it('maps the database quota error to a plain message', async () => {
    upload.mockResolvedValue({ error: { message: 'quota_exceeded: the folder would pass its quota' } });
    const d = blank();
    d.cover = addPending(file('cover.svg'));
    await expect(commitPendingMedia(d)).rejects.toThrow(/storage is full/i);
  });
});
