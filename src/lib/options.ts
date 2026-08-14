// Canonical option lists — the SINGLE source of truth for every dropdown/chip.
// Onboarding, Profile edit, and Discover filters all import from here so a value
// saved in one place is always recognised in the others (fixes filters/compat
// silently breaking after a profile edit).

export const GENDERS = ['male', 'female'];
export const MARITAL = ['Never married', 'Divorced', 'Widowed'];
export const PRAYER = ['5 Daily Prayers', 'Usually prays', 'Sometimes prays', 'Working on it'];
export const PRACTICE = ['Very practicing', 'Practicing', 'Moderately practicing', 'Still learning'];
export const MARRIAGE_INTENT = ['Marriage as soon as possible', 'Marriage within 1–2 years', 'Getting to know for marriage'];
export const TIMELINE = ['As soon as possible', 'Within 1 year', '1–2 years', '2–3 years', 'Not sure yet'];
export const RELOCATE = ['Willing to relocate', 'Not willing to relocate', 'Open to discussion'];
export const WANT_KIDS = ['Want children', "Don't want children", 'Open / not sure'];
export const HAS_KIDS = ['No', 'Yes — living with me', 'Yes — not living with me'];
export const TRAITS = ['Calm', 'Funny', 'Patient', 'Ambitious', 'Introvert', 'Extrovert', 'Family-Oriented', 'Adventurous', 'Organized', 'Kind', 'Generous'];
export const STYLES = ['Calm', 'Direct', 'Gentle', 'Honest', 'Listener', 'Problem Solver', 'Affectionate'];
export const GOALS = ['Strong Islamic Home', 'Children', 'Career', 'Business', 'Education', 'Travel', 'Financial Stability', 'Memorise Quran'];
