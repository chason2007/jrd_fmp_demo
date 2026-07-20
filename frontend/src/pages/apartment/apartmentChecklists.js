/**
 * Apartment Inspection checklist — transcribed from the reference report.
 *
 * Responses are keyed by `${sectionKey}:${itemIndex}` rather than by the question
 * text, because (a) Bedroom/Bathroom sections repeat and (b) the source template
 * legitimately repeats item labels within a section (Bedroom lists "Smoke Alarm"
 * twice). Indexing keeps every answer distinct.
 */

export const RESPONSE_OPTIONS = ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A'];

/**
 * Building layout: 7 floors, 7 rooms each — 101–107, 201–207, … 701–707.
 * Room numbers encode their floor (first digit), so the floor isn't stored
 * separately; derive it with floorOfRoom() when needed.
 */
export const FLOOR_COUNT = 7;
export const ROOMS_PER_FLOOR = 7;

export const ROOMS_BY_FLOOR = Array.from({ length: FLOOR_COUNT }, (_, f) => ({
  floor: f + 1,
  rooms: Array.from({ length: ROOMS_PER_FLOOR }, (_, r) => `${f + 1}0${r + 1}`),
}));

/** Every valid room number, flat. */
export const ALL_ROOMS = ROOMS_BY_FLOOR.flatMap((f) => f.rooms);

/** Floor a room number sits on (101 → 1, 704 → 7); null if not a known room. */
export const floorOfRoom = (roomNo) => {
  const s = String(roomNo || '').trim();
  return ALL_ROOMS.includes(s) ? Number(s[0]) : null;
};

/** Answers that count as a non-compliance and therefore require a remark + photo. */
export const NON_COMPLIANT_ANSWERS = ['Needs Improvement', 'Unsatisfactory'];

/** Sections that appear exactly once, in report order. */
export const FIXED_SECTIONS = [
  {
    key: 'main_entrance',
    name: 'Main Entrance',
    items: [
      'Door Bell',
      'Unit entrance doors',
      'Light fixture',
      'Intercom',
      'Fuse/breaker panel',
    ],
  },
  {
    key: 'hallway',
    name: 'Hallway / Vestibule',
    items: [
      'Ceiling/wall finishes & trimwork',
      'Flooring',
      'Electrical switches & outlets',
      'Light fixtures',
      'Closet doors, hardware, rod & shelf',
      'Smoke detector',
    ],
  },
  {
    key: 'living_room',
    name: 'Living Room',
    items: [
      'Walls and Ceiling',
      'Floor Covering',
      'Windows (curtains, blinds, etc…)',
      'Doors',
      'Light Fixtures',
      'TV & TV Table',
      'Furniture (if applicable)',
    ],
  },
  {
    key: 'dining_room',
    name: 'Dining Room',
    items: [
      'Floor & Floor Covering(s)',
      'Walls & Ceiling',
      'Light Fixture(s)',
      'Window(s) & Screen(s)',
      'Balcony',
    ],
  },
  {
    key: 'kitchen',
    name: 'Kitchen',
    items: [
      'Floor & Floor Coverings',
      'Walls & Ceiling',
      'Door(s)',
      'Door Lock(s) and Hardware',
      'Window(s) & Screen(s)',
      'Window Covering(s)',
      'Light Fixture(s)',
      'Cabinets/Inside Drawers',
      'Counters',
      'Kitchen hood/Cooker',
      'Oven/Range Hood Inside, Outside, Fan',
      'Refrigerator',
      'Dishwasher',
      'Sink(s) & Plumbing',
      'Garbage Disposal',
    ],
  },
];

/** Repeated once per bedroom. Duplicate labels are intentional (match the source). */
export const BEDROOM_ITEMS = [
  'Floors & Floor Covering(s)',
  'Walls & Ceilings',
  'Dressing table & mirror',
  'Window Curtains',
  'Lighting Fixtures',
  'Smoke Alarm',
  'Door(s)',
  'Light Fixture(s)',
  'Smoke Alarm',
  'Door Lock(s) & Hardware(s)',
];

/** Repeated once per bathroom. */
export const BATHROOM_ITEMS = [
  'Floors & Floor Covering(s)',
  'Walls & Ceilings',
  'Counters & Surfaces',
  'Window(s) & Screen(s)',
  'Mirror / Soap dish & toothbrush Holder',
  'Sink & Plumbing',
  'Bathtub/Shower/ Curtain rod/Soap dish',
  'Toilet',
  'Light Fixture(s)',
  'Door(s)',
  'Door Lock(s) & Hardware(s)',
  'Inside Drawers',
];

/** Stable key for one checklist answer. */
export const itemKey = (sectionKey, index) => `${sectionKey}:${index}`;

/** The full ordered section list for a given number of bedrooms/bathrooms. */
export function buildSections(bedroomCount = 1, bathroomCount = 1) {
  const sections = FIXED_SECTIONS.map((s) => ({ ...s }));
  for (let i = 1; i <= Math.max(0, bedroomCount); i += 1) {
    sections.push({ key: `bedroom_${i}`, name: `Bedroom ${i}`, items: BEDROOM_ITEMS });
  }
  for (let i = 1; i <= Math.max(0, bathroomCount); i += 1) {
    sections.push({ key: `bathroom_${i}`, name: `Bathroom ${i}`, items: BATHROOM_ITEMS });
  }
  return sections;
}

export const totalItemCount = (bedroomCount = 1, bathroomCount = 1) =>
  buildSections(bedroomCount, bathroomCount).reduce((n, s) => n + s.items.length, 0);

/**
 * Score an inspection. N/A is excluded from the score entirely so it can't drag
 * the result down; Satisfactory=100, Needs Improvement=50, Unsatisfactory=0.
 * Rating bands match the other modules.
 */
export function scoreApartment(sections, responses = {}) {
  let scored = 0;
  let sum = 0;
  let satisfactoryCount = 0;
  let needsImprovementCount = 0;
  let unsatisfactoryCount = 0;
  let naCount = 0;

  for (const section of sections) {
    section.items.forEach((_, i) => {
      const answer = responses[itemKey(section.key, i)]?.answer;
      if (!answer) return;
      if (answer === 'N/A') { naCount += 1; return; }
      scored += 1;
      if (answer === 'Satisfactory') { sum += 100; satisfactoryCount += 1; }
      else if (answer === 'Needs Improvement') { sum += 50; needsImprovementCount += 1; }
      else { unsatisfactoryCount += 1; }
    });
  }

  const percent = scored > 0 ? sum / scored : 0;
  const rating = percent >= 90 ? 'Excellent' : percent >= 75 ? 'Good' : percent >= 60 ? 'Average' : 'Poor';
  return { percent, rating, totalItems: scored, satisfactoryCount, needsImprovementCount, unsatisfactoryCount, naCount };
}

/** Keys of answered non-compliant items missing a remark or a photo. */
export function missingEvidenceKeys(sections, responses = {}) {
  const out = [];
  for (const section of sections) {
    section.items.forEach((label, i) => {
      const key = itemKey(section.key, i);
      const r = responses[key];
      if (!r || !NON_COMPLIANT_ANSWERS.includes(r.answer)) return;
      if (!String(r.comment || '').trim() || !(r.images || []).length) {
        out.push({ key, section: section.name, label });
      }
    });
  }
  return out;
}
