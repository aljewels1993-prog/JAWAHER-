import { describe, it, expect } from 'vitest';
import { QUESTIONS, questionsForStage } from '../src/data/questions.js';
import { STAGES } from '../src/data/stages.js';

describe('grammar questions', () => {
  it('has exactly 50 questions, 5 per stage', () => {
    expect(QUESTIONS).toHaveLength(50);
    for (const s of STAGES) expect(questionsForStage(s.id)).toHaveLength(5);
  });
  it('has unique ids and unique prompts', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(50);
    expect(new Set(QUESTIONS.map((q) => q.prompt.toLowerCase())).size).toBe(50);
  });
  it('every question has 4 distinct options, one valid answer, a blank, a hint and an explanation', () => {
    for (const q of QUESTIONS) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.prompt).toMatch(/_{3,}/);
      expect(q.hint.length).toBeGreaterThan(10);
      expect(q.explain.length).toBeGreaterThan(10);
    }
  });
  it('hints never reveal the answer', () => {
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const q of QUESTIONS) {
      const answer = q.options[q.answer].toLowerCase();
      const re = new RegExp(`(^|[^a-z'])${esc(answer)}([^a-z']|$)`);
      expect(re.test(q.hint.toLowerCase()), `${q.id} hint contains "${answer}"`).toBe(false);
      expect(q.hint.toLowerCase()).not.toMatch(/answer is|correct answer|choose "/);
    }
  });
  it('every question has a key word that appears in its sentence (second-level hint)', () => {
    for (const q of QUESTIONS) {
      expect(q.key, q.id).toBeTruthy();
      expect(q.prompt.includes(q.key), `${q.id} key "${q.key}"`).toBe(true);
      expect(q.key.toLowerCase()).not.toBe(q.options[q.answer].toLowerCase());
    }
  });
  it('covers all the required grammar topics', () => {
    const topics = QUESTIONS.map((q) => q.topic).join('|');
    for (const t of ['Present Simple', 'Present Continuous', 'Past Simple', 'will', 'going to', 'Present Perfect',
      'Comparatives', 'Superlatives', 'Modals: can', 'Modals: could', 'Modals: have to', 'Modals: should',
      'Prepositions', 'Subject-verb agreement', 'Articles', 'Adjectives', 'Adverbs']) {
      expect(topics).toContain(t);
    }
  });
  it('spreads correct answers over all positions (no "always A")', () => {
    const counts = [0, 0, 0, 0];
    QUESTIONS.forEach((q) => counts[q.answer]++);
    counts.forEach((c) => expect(c).toBeGreaterThan(4));
  });
});
