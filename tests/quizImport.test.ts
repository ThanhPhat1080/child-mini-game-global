import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseQuizImport } from '@/lib/quizImport';

const q = (over: Record<string, unknown> = {}) => ({
  text: 'Where is the apple?',
  image: '',
  answers: [
    { text: 'Apple', image: '', correct: true },
    { text: 'Banana', image: '', correct: false },
  ],
  ...over,
});
const run = (questions: unknown) => parseQuizImport(JSON.stringify({ questions }));

describe('parseQuizImport', () => {
  it('accepts the shipped template', () => {
    const r = parseQuizImport(readFileSync('public/quiz-template.json', 'utf8'));
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(2);
    expect(r.questions[1].count).toBe(2);
    expect(r.questions[1].correct).toBe(1);
  });

  it('maps a valid question, with blank images as null', () => {
    const r = run([q()]);
    expect(r.errors).toEqual([]);
    const [a] = r.questions;
    expect(a.text).toBe('Where is the apple?');
    expect(a.qimg).toBeNull();
    expect(a.imgs).toEqual([null, null, null]);
    expect(a.texts.slice(0, 2)).toEqual(['Apple', 'Banana']);
    expect(a.correct).toBe(0);
    expect(a.count).toBe(2);
    expect(a.readAnswers).toBe(true);
    expect(a.voice).toBeNull();
  });

  it('accepts https image links and a bare array', () => {
    const r = parseQuizImport(JSON.stringify([q({ image: ' https://example.com/q.svg ', answers: [
      { image: 'https://example.com/a.svg', correct: true }, { correct: false }, { correct: false },
    ] })]));
    expect(r.errors).toEqual([]);
    expect(r.questions[0].qimg).toBe('https://example.com/q.svg');
    expect(r.questions[0].imgs[0]).toBe('https://example.com/a.svg');
    expect(r.questions[0].count).toBe(3);
  });

  it('hideAnswerText defaults to false and is read when given', () => {
    expect(run([q()]).questions[0].hideAnswerText).toBe(false);
    expect(run([q({ hideAnswerText: true })]).questions[0].hideAnswerText).toBe(true);
    expect(run([q({ hideAnswerText: false })]).questions[0].hideAnswerText).toBe(false);
  });

  it('rejects a hideAnswerText that is not true or false', () => {
    expect(run([q({ hideAnswerText: 'yes' })]).errors).toEqual(['Question 1: hideAnswerText must be true or false']);
  });

  it('honours readAnswersAloud: false', () => {
    expect(run([q({ readAnswersAloud: false })]).questions[0].readAnswers).toBe(false);
  });

  it('rejects invalid JSON and a missing list', () => {
    expect(parseQuizImport('{nope').errors[0]).toMatch(/not valid JSON/);
    expect(parseQuizImport('{}').errors[0]).toMatch(/"questions" list/);
    expect(run([]).errors[0]).toMatch(/empty/);
  });

  it('rejects more than 50 questions', () => {
    expect(run(Array.from({ length: 51 }, () => q())).errors[0]).toMatch(/Too many/);
  });

  it('needs 2 or 3 answers', () => {
    expect(run([q({ answers: [{ correct: true }] })]).errors).toEqual(['Question 1: needs 2 or 3 answers.']);
    const four = Array.from({ length: 4 }, (_, i) => ({ correct: i === 0 }));
    expect(run([q({ answers: four })]).errors).toEqual(['Question 1: needs 2 or 3 answers.']);
  });

  it('needs exactly one correct answer', () => {
    const none = run([q({ answers: [{ correct: false }, { correct: false }] })]);
    expect(none.errors[0]).toMatch(/exactly one answer.*found 0/);
    const two = run([q({ answers: [{ correct: true }, { correct: true }] })]);
    expect(two.errors[0]).toMatch(/found 2/);
  });

  it('only allows blank or https image links', () => {
    expect(run([q({ image: 'http://example.com/a.png' })]).errors[0]).toMatch(/https:\/\//);
    expect(run([q({ image: 'seed/apple.svg' })]).errors[0]).toMatch(/blank, a link starting with https/);
    expect(run([q({ image: 'data:image/png;base64,AAAA' })]).errors[0]).toMatch(/blank, a link starting with https/);
    expect(run([q({ image: 5 })]).errors[0]).toMatch(/must be text/);
    const bad = run([q({ answers: [{ image: 'ftp://x', correct: true }, { correct: false }] })]);
    expect(bad.errors[0]).toMatch(/^Question 1, answer 1:/);
  });

  it('reports every problem with its question number and imports nothing', () => {
    const r = run([q(), q({ answers: [{ correct: false }, { correct: false }] }), 'oops']);
    expect(r.questions).toEqual([]);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^Question 2:/);
    expect(r.errors[1]).toMatch(/^Question 3:/);
  });

  describe('inline SVG code', () => {
    const svg = "<svg viewBox='0 0 84 84'><circle cx='42' cy='42' r='36' fill='#E59AA1'/></svg>";
    const withImg = (image: string) => run([q({ answers: [{ text: 'Bear', image, correct: true }, { correct: false }] })]);

    it('is accepted for answers and the question image, and xmlns is added', () => {
      const r = run([q({ image: svg, answers: [{ image: svg, correct: true }, { correct: false }] })]);
      expect(r.errors).toEqual([]);
      expect(r.questions[0].qimg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(r.questions[0].imgs[0]).toBe(r.questions[0].qimg);
    });

    it('keeps an existing xmlns and strips an <?xml ?> line', () => {
      const r = withImg('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>');
      expect(r.errors).toEqual([]);
      expect(r.questions[0].imgs[0]!.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox')).toBe(true);
      expect(r.questions[0].imgs[0]!.match(/xmlns=/g)).toHaveLength(1);
    });

    it('turns identical drawings (any spacing) into identical text so they can share one file', () => {
      const spaced = "<svg  viewBox='0 0 84 84'>\n  <circle cx='42' cy='42' r='36' fill='#E59AA1'/>\n</svg>";
      const r = run([q({ answers: [{ image: svg, correct: true }, { image: spaced }, { image: svg }] })]);
      expect(r.errors).toEqual([]);
      const [a, b, c] = r.questions[0].imgs;
      expect(a).toBeTruthy();
      expect(b).toBe(a);
      expect(c).toBe(a);
    });

    it.each([
      ['a script', "<svg viewBox='0 0 8 8'><script>alert(1)</script></svg>", /scripts/],
      ['an event handler', "<svg viewBox='0 0 8 8' onload='x()'><rect/></svg>", /event handlers/],
      ['foreignObject', "<svg viewBox='0 0 8 8'><foreignObject/></svg>", /foreignObject/],
      ['an external link', "<svg viewBox='0 0 8 8'><image href='https://x.test/a.png'/></svg>", /link to other files/],
      ['an external url()', "<svg viewBox='0 0 8 8'><rect fill='url(https://x.test/g)'/></svg>", /link to other files/],
      ['a javascript: link', "<svg viewBox='0 0 8 8'><a href='javascript:x()'><rect/></a></svg>", /scripts|link to other files/],
    ])('rejects %s', (_n, code, msg) => {
      expect(withImg(code).errors[0]).toMatch(msg);
    });

    it.each([
      ['a CDATA <style> (Illustrator, Figma)', "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'><style><![CDATA[ .a{fill:#4F7A9E} ]]></style><rect class='a' width='8' height='8'/></svg>"],
      ['an <?xml ?> line and a simple DOCTYPE', '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>'],
      ['a leading comment', "<!-- made by me --><svg viewBox='0 0 8 8'><rect width='8' height='8'/></svg>"],
      ['Inkscape metadata and namespaces', '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns="http://www.w3.org/2000/svg" width="84" height="84"><metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><dc:title>x</dc:title></rdf:RDF></metadata><circle cx="42" cy="42" r="30"/></svg>'],
      ['xlink:href to an #id', "<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 8 8'><defs><circle id='c' r='2'/></defs><use xlink:href='#c'/></svg>"],
      ['&nbsp; (converted)', "<svg viewBox='0 0 8 8'><text>a&nbsp;b</text></svg>"],
      ['width/height without a viewBox', "<svg width='84' height='84'><circle cx='42' cy='42' r='30'/></svg>"],
    ])('accepts %s', (_n, code) => {
      const r = withImg(code);
      expect(r.errors).toEqual([]);
      expect(r.questions[0].imgs[0]).toMatch(/^<svg /);
      expect(r.questions[0].imgs[0]).not.toMatch(/DOCTYPE|<\?xml/);
    });

    it('explains why a DOCTYPE with definitions, embedded pictures and HTML entities are rejected', () => {
      expect(withImg('<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 8 8"><rect/></svg>').errors[0]).toMatch(/DOCTYPE|ENTITY/);
      expect(withImg("<svg viewBox='0 0 8 8'><image href='data:image/png;base64,iVBORw0KGgo='/></svg>").errors[0]).toMatch(/embed pictures/);
      expect(withImg("<svg viewBox='0 0 8 8'><text>&copy;</text></svg>").errors[0]).toMatch(/not valid XML.*&copy;/);
    });

    it('allows #id references (gradients, <use>)', () => {
      expect(withImg("<svg viewBox='0 0 8 8'><defs><linearGradient id='g'/></defs><rect fill='url(#g)'/><use href='#g'/></svg>").errors).toEqual([]);
    });

    it('rejects broken or oversized SVG', () => {
      expect(withImg("<svg viewBox='0 0 8 8'><rect></svg>").errors[0]).toMatch(/not valid/);
      expect(withImg("<svg viewBox='0 0 8 8'><rect/>").errors[0]).toMatch(/end with <\/svg>/);
      expect(withImg(`<svg viewBox='0 0 8 8'><desc>${'a'.repeat(30001)}</desc></svg>`).errors[0]).toMatch(/longer than 30,000/);
    });
  });

  it('allows blank question text (finish it in the editor)', () => {
    expect(run([q({ text: '' })]).errors).toEqual([]);
  });
});
