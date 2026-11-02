/**
 * Plain-language guidance shown to teachers while scoring. DRAFT wording —
 * ROADMAP Phase 0 replaces it with educator-authored descriptors and exemplar
 * images. Keys match DEFAULT_RUBRIC_CRITERIA in @progressflow/shared.
 */
import type { PerformanceLevel } from './enums.js';

export const LEVEL_LABELS: Record<PerformanceLevel, string> = {
  1: 'Emerging',
  2: 'Developing',
  3: 'Proficient',
  4: 'Exemplary',
};

export interface CriterionGuide {
  key: string;
  name: string;
  icon: string; // MaterialCommunityIcons
  color: string;
  tagline: string;
  lookFor: { title: string; text: string }[];
  askStudent: string;
  levels: Record<PerformanceLevel, string>;
}

export const RUBRIC_GUIDES: CriterionGuide[] = [
  {
    key: 'composition',
    name: 'Composition',
    icon: 'grid',
    color: '#2E5AAC',
    tagline: 'How the work is arranged on the page',
    lookFor: [
      {
        title: 'Focal point',
        text: 'Where does your eye land first? Is that the intended subject?',
      },
      { title: 'Balance', text: 'Is the visual weight spread so nothing feels lopsided?' },
      {
        title: 'Use of space',
        text: 'Is the page used well, or is the subject squeezed into a corner or floating small?',
      },
    ],
    askStudent: 'Why did you place the main object here?',
    levels: {
      1: 'Subject is tiny, cut off or lost. No clear place for the eye to land.',
      2: 'Subject is readable but placement looks accidental. Big empty or crowded areas.',
      3: 'Clear focal point, sensible size, space mostly balanced.',
      4: 'Deliberate arrangement that leads the eye. Space and balance support the idea.',
    },
  },
  {
    key: 'colour_theory',
    name: 'Colour theory',
    icon: 'palette-outline',
    color: '#C2410C',
    tagline: 'Choice and use of colour or tone',
    lookFor: [
      { title: 'Palette', text: 'A few chosen colours that work together, or a random mix?' },
      {
        title: 'Contrast & value',
        text: 'Do light and dark differences make shapes easy to read?',
      },
      { title: 'Mood', text: 'Do the colours suit what the work is about?' },
    ],
    askStudent: 'Why did you choose these colours?',
    levels: {
      1: 'Colours are random or unchanged from the tool. Shapes blur together.',
      2: 'Some deliberate choices, but harmony or contrast is inconsistent.',
      3: 'Cohesive palette with clear light/dark contrast.',
      4: 'Colour is used on purpose to build mood, depth or emphasis.',
    },
  },
  {
    key: 'technical_skill',
    name: 'Technical skill',
    icon: 'brush',
    color: '#2E7D32',
    tagline: 'Control of the medium and tools',
    lookFor: [
      { title: 'Line & pressure', text: 'Are lines confident and varied, or shaky and uniform?' },
      {
        title: 'Form & shading',
        text: 'Does the object look solid, with smooth light-to-dark shading?',
      },
      { title: 'Finish', text: 'Neat edges, believable proportions, little smudging.' },
    ],
    askStudent: 'Which part was hardest to draw?',
    levels: {
      1: 'Heavy or uncontrolled marks. Shapes and proportions are hard to recognise.',
      2: 'Basic control. Shading is patchy or flat, proportions slip.',
      3: 'Controlled lines, smooth shading, proportions mostly right.',
      4: 'Confident, varied marks; convincing form and a polished finish.',
    },
  },
  {
    key: 'conceptual_depth',
    name: 'Conceptual depth',
    icon: 'lightbulb-on-outline',
    color: '#7B3FA0',
    tagline: 'The idea behind the work',
    lookFor: [
      { title: 'Idea', text: 'Is there a reason behind what was drawn and how?' },
      { title: 'Own voice', text: 'Does it show personal observation, not just copying?' },
      { title: 'Meaning', text: 'Can a viewer tell what it is about?' },
    ],
    askStudent: 'What were you trying to show?',
    levels: {
      1: 'No visible idea beyond copying the subject.',
      2: 'An idea is hinted at but not developed.',
      3: 'A clear idea carries through the piece.',
      4: 'Original, layered idea with a personal viewpoint that the work communicates well.',
    },
  },
];
