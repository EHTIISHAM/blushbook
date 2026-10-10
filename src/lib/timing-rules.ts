/**
 * Default service timings, from the BooknBloom service timing rulebook
 * (BooknBloom_Service_Timing_Rulebook.xlsx, 2026-10-09).
 *
 * When a rate card has no time against a service, the service name is matched
 * against these keywords to suggest a length, a buffer after it, and the grid
 * customer start times sit on. Anything uncertain is flagged for the business
 * to check before clients book it.
 *
 * Plain data and pure functions: safe to import on the client and the server.
 */

export const SECTORS = [
  "salon",
  "clinic",
  "dentist",
  "tutor",
  "coach",
  "consultant",
  "pet",
  "local",
] as const;

export type Sector = (typeof SECTORS)[number];

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}

export type Confidence = "high" | "medium" | "low";

/** Where a suggested timing came from. */
export type TimingSource = "rate_card" | "keyword" | "safe_default";

export interface TimingRule {
  sector: Sector;
  category: string;
  name: string;
  /** Lowercase words or phrases that point at this service. */
  keywords: string[];
  minutes: number;
  /** Time kept free after the service, for clean-up or notes. */
  buffer: number;
  /** Customer start times are offered every this many minutes. */
  step: number;
  confidence: Confidence;
  source: Exclude<TimingSource, "rate_card">;
  /** The rulebook marks this one "Required" for business approval. */
  approvalRequired: boolean;
  note?: string;
}

/** Above this, a timing is always checked by the business. */
export const LONG_SERVICE_MINUTES = 120;

export const SECTOR_DEFAULTS: Record<
  Sector,
  { label: string; step: number; typical: string; note: string }
> = {
  salon: { label: "Salon / Beauty", step: 15, typical: "30 mins if consultation; 45-60 mins if haircut; 90+ mins if colour", note: "Show approval for colour or any service above 120 mins." },
  clinic: { label: "Clinic", step: 15, typical: "30 mins standard; 45 mins initial consultation; 60 mins therapy", note: "Show approval for aesthetics or generic service wording." },
  dentist: { label: "Dentist", step: 15, typical: "30 mins check-up; 45 mins hygiene; 60+ mins treatment", note: "Show approval for clinical treatment services." },
  tutor: { label: "Tutor", step: 15, typical: "60 mins standard lesson; 30 mins short session", note: "Business can set lesson length once and reuse." },
  coach: { label: "Coach", step: 15, typical: "60 mins standard session; 30 mins discovery call", note: "Discovery calls can be optional/free." },
  consultant: { label: "Consultant", step: 15, typical: "60 mins advisory; 30 mins discovery; 90 mins strategy", note: "Long workshops should require approval." },
  pet: { label: "Pet Services", step: 15, typical: "60-90 mins grooming; 30 mins walk or visit", note: "Pet size may change timing." },
  local: { label: "Local Services", step: 30, typical: "60 mins visit default; 120+ mins cleaning/detailing", note: "Often needs job-size confirmation." },
};

export const TIMING_RULES: TimingRule[] = [
  { sector: "salon", category: "Hair", name: "Haircut", keywords: ["cut", "haircut", "trim"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false, note: "Use 60 mins for thicker/long hair if needed." },
  { sector: "salon", category: "Hair", name: "Cut and blow dry", keywords: ["cut", "blow dry", "haircut"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false, note: "Common default when rate card does not specify timing." },
  { sector: "salon", category: "Hair", name: "Wash and blow dry", keywords: ["wash", "blow dry", "blowout"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Hair", name: "Dry cut", keywords: ["dry cut"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Hair", name: "Fringe trim", keywords: ["fringe", "bang trim"], minutes: 15, buffer: 5, step: 15, confidence: "high", source: "keyword", approvalRequired: false, note: "Can be a quick add-on." },
  { sector: "salon", category: "Hair", name: "Hair treatment", keywords: ["treatment", "mask", "repair"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Colour", name: "Root colour", keywords: ["root colour", "root tint", "roots"], minutes: 90, buffer: 15, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Colour", name: "Full colour", keywords: ["full colour", "full head colour", "tint"], minutes: 120, buffer: 15, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Colour", name: "Highlights", keywords: ["highlights", "foils"], minutes: 150, buffer: 15, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Colour", name: "Balayage", keywords: ["balayage", "ombre"], minutes: 180, buffer: 20, step: 15, confidence: "medium", source: "keyword", approvalRequired: false, note: "Long services should show fewer customer slots." },
  { sector: "salon", category: "Colour", name: "Colour correction", keywords: ["colour correction", "correction"], minutes: 240, buffer: 30, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Business should confirm because timings vary widely." },
  { sector: "salon", category: "Beauty", name: "Manicure", keywords: ["manicure", "nails"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Beauty", name: "Gel manicure", keywords: ["gel manicure", "shellac"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Beauty", name: "Pedicure", keywords: ["pedicure"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Beauty", name: "Facial", keywords: ["facial", "skin treatment"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Beauty", name: "Brows", keywords: ["brow", "eyebrow", "threading"], minutes: 20, buffer: 5, step: 10, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "salon", category: "Beauty", name: "Waxing", keywords: ["wax", "waxing"], minutes: 30, buffer: 10, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Depends heavily on body area." },
  { sector: "salon", category: "Consultation", name: "Consultation", keywords: ["consultation", "patch test"], minutes: 30, buffer: 5, step: 15, confidence: "high", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Consultation", name: "Initial consultation", keywords: ["initial", "first appointment", "consultation"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Consultation", name: "Follow-up appointment", keywords: ["follow-up", "review"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Consultation", name: "Standard appointment", keywords: ["appointment", "session"], minutes: 30, buffer: 5, step: 15, confidence: "low", source: "safe_default", approvalRequired: true, note: "Use when service wording is generic." },
  { sector: "clinic", category: "Therapy", name: "Physiotherapy assessment", keywords: ["physio assessment", "assessment"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Therapy", name: "Physiotherapy follow-up", keywords: ["physio follow-up", "rehab"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Therapy", name: "Sports massage", keywords: ["sports massage", "massage"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Therapy", name: "Acupuncture", keywords: ["acupuncture"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Wellness", name: "Blood test appointment", keywords: ["blood test", "blood draw"], minutes: 15, buffer: 5, step: 5, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Wellness", name: "Health check", keywords: ["health check", "screening"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Wellness", name: "Vaccination", keywords: ["vaccine", "vaccination", "jab"], minutes: 15, buffer: 5, step: 5, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Aesthetics", name: "Aesthetic consultation", keywords: ["aesthetic consultation", "skin consultation"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "clinic", category: "Aesthetics", name: "Injectables appointment", keywords: ["botox", "filler", "injectables"], minutes: 45, buffer: 10, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Compliance and consultation rules may vary." },
  { sector: "dentist", category: "Check-up", name: "Dental check-up", keywords: ["check-up", "exam", "dental exam"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Check-up", name: "Check-up and clean", keywords: ["check-up and clean", "exam and clean"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Hygiene", name: "Hygienist appointment", keywords: ["hygienist", "hygiene"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Hygiene", name: "Scale and polish", keywords: ["scale", "polish", "clean"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Cosmetic", name: "Teeth whitening", keywords: ["whitening"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Treatment", name: "Filling", keywords: ["filling"], minutes: 60, buffer: 15, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Timing depends on number and complexity." },
  { sector: "dentist", category: "Treatment", name: "Extraction", keywords: ["extraction", "tooth removal"], minutes: 60, buffer: 15, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Timing depends on complexity." },
  { sector: "dentist", category: "Treatment", name: "Root canal", keywords: ["root canal", "endodontic"], minutes: 90, buffer: 20, step: 15, confidence: "low", source: "keyword", approvalRequired: true },
  { sector: "dentist", category: "Emergency", name: "Emergency appointment", keywords: ["emergency", "urgent"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "dentist", category: "Consultation", name: "Orthodontic consultation", keywords: ["orthodontic", "braces", "aligner consultation"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Academic", name: "One-to-one tutoring", keywords: ["tutoring", "tuition", "lesson"], minutes: 60, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Academic", name: "Short tutoring session", keywords: ["short lesson", "booster"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Academic", name: "Exam preparation", keywords: ["exam prep", "gcse", "a-level", "sat"], minutes: 60, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Academic", name: "Assessment session", keywords: ["assessment", "level check"], minutes: 45, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Academic", name: "Group class", keywords: ["group class", "class"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Music", name: "Music lesson", keywords: ["music lesson", "piano", "guitar", "violin"], minutes: 45, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Language", name: "Language lesson", keywords: ["language", "english", "french", "spanish"], minutes: 60, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "tutor", category: "Consultation", name: "Parent consultation", keywords: ["parent consultation", "progress review"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Fitness", name: "Personal training", keywords: ["personal training", "pt"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Fitness", name: "Fitness consultation", keywords: ["fitness consultation", "assessment"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Fitness", name: "Small group training", keywords: ["small group", "group training"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Wellness", name: "Nutrition consultation", keywords: ["nutrition", "diet consultation"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Wellness", name: "Wellness coaching", keywords: ["wellness", "wellbeing"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Business", name: "Business coaching", keywords: ["business coaching", "founder coaching"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Career", name: "Career coaching", keywords: ["career coaching", "cv review", "interview prep"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Life", name: "Life coaching", keywords: ["life coaching", "mindset"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "coach", category: "Discovery", name: "Discovery call", keywords: ["discovery", "intro call"], minutes: 30, buffer: 5, step: 15, confidence: "high", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Discovery", name: "Discovery call", keywords: ["discovery call", "intro", "consultation"], minutes: 30, buffer: 5, step: 15, confidence: "high", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Advisory", name: "Advisory session", keywords: ["advisory", "advice", "consultation"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Strategy", name: "Strategy session", keywords: ["strategy", "planning"], minutes: 90, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Review", name: "Document review", keywords: ["document review", "contract review"], minutes: 60, buffer: 10, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "May vary by document size." },
  { sector: "consultant", category: "Finance", name: "Tax consultation", keywords: ["tax", "accounting", "finance consultation"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Legal", name: "Legal consultation", keywords: ["legal", "solicitor", "lawyer"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Marketing", name: "Marketing audit", keywords: ["marketing audit", "campaign review"], minutes: 90, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Technical", name: "Technical support call", keywords: ["technical support", "tech call"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "consultant", category: "Workshop", name: "Workshop", keywords: ["workshop", "training workshop"], minutes: 120, buffer: 15, step: 15, confidence: "low", source: "keyword", approvalRequired: true, note: "Long services should require approval." },
  { sector: "pet", category: "Grooming", name: "Full pet groom", keywords: ["full groom", "grooming"], minutes: 90, buffer: 15, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Grooming", name: "Bath and brush", keywords: ["bath", "brush"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Grooming", name: "Nail clipping", keywords: ["nail clip", "nails"], minutes: 15, buffer: 5, step: 5, confidence: "high", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Grooming", name: "Puppy groom", keywords: ["puppy groom"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Care", name: "Dog walking", keywords: ["dog walk", "walking"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Care", name: "Pet sitting visit", keywords: ["pet sitting", "home visit"], minutes: 30, buffer: 5, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Training", name: "Dog training session", keywords: ["dog training", "training"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Consultation", name: "Behaviour consultation", keywords: ["behaviour", "behavior", "consultation"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "pet", category: "Veterinary", name: "Vet consultation", keywords: ["vet", "veterinary", "animal clinic"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Home", name: "Home cleaning", keywords: ["cleaning", "cleaner"], minutes: 120, buffer: 15, step: 30, confidence: "low", source: "keyword", approvalRequired: true, note: "Duration often depends on home size." },
  { sector: "local", category: "Home", name: "Deep cleaning", keywords: ["deep clean", "deep cleaning"], minutes: 240, buffer: 30, step: 30, confidence: "low", source: "keyword", approvalRequired: true },
  { sector: "local", category: "Home", name: "Handyman visit", keywords: ["handyman", "repair", "maintenance"], minutes: 60, buffer: 15, step: 15, confidence: "low", source: "safe_default", approvalRequired: true },
  { sector: "local", category: "Home", name: "Plumbing visit", keywords: ["plumber", "plumbing"], minutes: 60, buffer: 15, step: 15, confidence: "low", source: "safe_default", approvalRequired: true },
  { sector: "local", category: "Home", name: "Electrician visit", keywords: ["electrician", "electrical"], minutes: 60, buffer: 15, step: 15, confidence: "low", source: "safe_default", approvalRequired: true },
  { sector: "local", category: "Automotive", name: "Car wash", keywords: ["car wash", "wash"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Automotive", name: "Car detailing", keywords: ["car detailing", "detailing"], minutes: 180, buffer: 20, step: 30, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Photography", name: "Mini photo session", keywords: ["mini shoot", "photo session"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Photography", name: "Standard photo session", keywords: ["photoshoot", "photography session"], minutes: 60, buffer: 15, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Events", name: "Event consultation", keywords: ["event consultation", "planning consultation"], minutes: 60, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Repairs", name: "Phone repair appointment", keywords: ["phone repair", "screen repair"], minutes: 45, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
  { sector: "local", category: "Repairs", name: "Device diagnostic", keywords: ["diagnostic", "device check"], minutes: 30, buffer: 10, step: 15, confidence: "medium", source: "keyword", approvalRequired: false },
];

/* ------------------------------------------------------------------ */

function normalize(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/** Whole-word match, allowing a plural on the last word. */
function contains(haystack: string, phrase: string): boolean {
  const needle = normalize(phrase).trim();
  if (!needle) return false;
  return new RegExp(` ${needle}(s|es)? `).test(haystack);
}

/**
 * The rule that best fits a service name. A rule whose own name appears wins
 * over keyword hits; then the rule with more matching keywords; then longer
 * keywords; then the earlier row in the rulebook.
 */
export function matchRule(
  name: string,
  sector: Sector | null,
): TimingRule | null {
  const text = normalize(name);
  let best: { rule: TimingRule; score: [number, number, number] } | null = null;

  for (const rule of TIMING_RULES) {
    if (sector && rule.sector !== sector) continue;

    const hits = rule.keywords.filter((keyword) => contains(text, keyword));
    const named = contains(text, rule.name) ? 1 : 0;
    if (!named && hits.length === 0) continue;

    const score: [number, number, number] = [
      named,
      hits.length,
      hits.reduce((sum, keyword) => sum + keyword.length, 0),
    ];

    if (
      !best ||
      score[0] > best.score[0] ||
      (score[0] === best.score[0] &&
        (score[1] > best.score[1] ||
          (score[1] === best.score[1] && score[2] > best.score[2])))
    ) {
      best = { rule, score };
    }
  }

  return best?.rule ?? null;
}

export interface TimingSuggestion {
  /** Null means "use the business's usual length". */
  minutes: number | null;
  buffer: number;
  step: number;
  confidence: Confidence;
  source: TimingSource;
  /** The rulebook row it came from, when one matched. */
  ruleName: string | null;
  /** Why the business should check this timing; null when it can go live. */
  review: string | null;
}

/**
 * Suggests a timing for one service, following the rulebook's order:
 * a time printed on the rate card, then a keyword match, then the safe default.
 */
export function suggestTiming(input: {
  name: string;
  /** The heading it sits under on the rate card, used when the name alone doesn't match. */
  section?: string;
  /** A time printed on the rate card for this service. */
  statedMinutes: number | null;
  sector: Sector | null;
  usualMinutes: number;
}): TimingSuggestion {
  const sectorStep = input.sector ? SECTOR_DEFAULTS[input.sector].step : 15;
  const rule =
    matchRule(input.name, input.sector) ??
    (input.section ? matchRule(`${input.section} ${input.name}`, input.sector) : null);

  let suggestion: TimingSuggestion;

  if (input.statedMinutes !== null) {
    // The business's own number wins; a matching rule still supplies the
    // buffer and grid it doesn't print.
    suggestion = {
      minutes: input.statedMinutes,
      buffer: rule?.buffer ?? 0,
      step: rule?.step ?? sectorStep,
      confidence: "high",
      source: "rate_card",
      ruleName: rule?.name ?? null,
      review: null,
    };
  } else if (rule) {
    const uncertain =
      rule.confidence === "low" ||
      rule.source === "safe_default" ||
      rule.approvalRequired;
    suggestion = {
      minutes: rule.minutes,
      buffer: rule.buffer,
      step: rule.step,
      confidence: rule.confidence,
      source: rule.source,
      ruleName: rule.name,
      review: uncertain
        ? (rule.note ?? "Timings for this vary a lot. Check the length.")
        : null,
    };
  } else {
    suggestion = {
      minutes: null,
      buffer: 0,
      step: sectorStep,
      confidence: "low",
      source: "safe_default",
      ruleName: null,
      review: input.sector
        ? `No close match, so it uses your usual length. Typical for ${SECTOR_DEFAULTS[input.sector].label.toLowerCase()}: ${SECTOR_DEFAULTS[input.sector].typical}.`
        : "No close match, so it uses your usual length. Check it.",
    };
  }

  const length = suggestion.minutes ?? input.usualMinutes;
  if (!suggestion.review && length > LONG_SERVICE_MINUTES) {
    suggestion.review = "Long service. Check the length before clients book it.";
  }

  return suggestion;
}
