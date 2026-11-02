import { z } from 'zod';
import { AssessmentKind, Language, PerformanceLevel } from './enums.js';
import { RUBRIC_GUIDES } from './rubricGuide.js';
import type { AnnotationStroke } from './entities.js';
import type { Scores, TimePoint } from './dashboard.js';

/**
 * Student portal, self-review and peer-review contracts.
 *
 * Students sign in with the 6-character join code on their record. A student
 * session can read only that student's own work; peer reviewers see an open
 * piece's images and nothing else, and a classmate's feedback reaches the
 * author only after the teacher approves it.
 */

export const CRITERION_KEYS = RUBRIC_GUIDES.map((g) => g.key);

export const StudentLoginBody = z.object({
  code: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/)),
});
export type StudentLoginBody = z.infer<typeof StudentLoginBody>;

export const ReviewKind = z.enum(['self', 'peer']);
export type ReviewKind = z.infer<typeof ReviewKind>;

/** Prompts, in order, for each kind of review. Their wording lives in the i18n dictionaries. */
export const REVIEW_PROMPTS = {
  self: ['worked', 'change', 'sure'],
  peer: ['works', 'suggest'],
} as const;

export const ReviewChoice = z.enum(['yes', 'partly', 'not_yet']);

export const REVIEW_TEXT_MAX = 500;

export const ReviewSubmitBody = z
  .object({
    kind: ReviewKind,
    submissionId: z.string().uuid(),
    scores: z.record(PerformanceLevel),
    answers: z
      .array(
        z.object({
          promptKey: z.string().max(60),
          choice: ReviewChoice.nullable().default(null),
          text: z.string().trim().max(REVIEW_TEXT_MAX).default(''),
        }),
      )
      .max(6),
  })
  .superRefine((v, ctx) => {
    const keys = Object.keys(v.scores).sort().join(',');
    if (keys !== [...CRITERION_KEYS].sort().join(',')) {
      ctx.addIssue({
        code: 'custom',
        message: 'score every criterion exactly once',
        path: ['scores'],
      });
    }
    const allowed = new Set<string>(REVIEW_PROMPTS[v.kind]);
    for (const a of v.answers) {
      if (!allowed.has(a.promptKey))
        ctx.addIssue({
          code: 'custom',
          message: `unknown prompt ${a.promptKey}`,
          path: ['answers'],
        });
    }
  });
export type ReviewSubmitBody = z.infer<typeof ReviewSubmitBody>;

export interface ReviewAnswer {
  promptKey: string;
  choice: 'yes' | 'partly' | 'not_yet' | null;
  text: string;
}

export interface ReviewView {
  id: string;
  scores: Scores;
  answers: ReviewAnswer[];
  createdAt: string;
  /** Only meaningful to the teacher; students only ever receive approved peer reviews. */
  approved: boolean;
  /** Reviewer's name, sent to the teacher only. */
  byName?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  rollNo: string;
  classLabel: string;
}

export interface StudentPiece {
  id: string;
  kind: AssessmentKind;
  createdAt: string;
  pages: { id: string; width: number; height: number; strokes: AnnotationStroke[] }[];
  scores: Scores;
  average: number | null;
  note: string;
  voice: { durationMs: number; language: Language; mediaId: string } | null;
  attachments: {
    id: string;
    kind: 'image' | 'file' | 'link' | 'note';
    title: string;
    url: string | null;
    text: string;
  }[];
  self: ReviewView | null;
  /** Approved classmate reviews, with no names. */
  peers: ReviewView[];
}

export interface StudentPortal {
  student: StudentProfile;
  pieces: StudentPiece[];
  history: TimePoint[];
  /** How many classmates' pieces are open for this student to review right now. */
  peerAvailable: number;
}

export interface PeerCandidate {
  id: string;
  pages: { id: string; width: number; height: number }[];
}
