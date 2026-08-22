import type { IncidentCategory, Severity } from './types'

/**
 * Multi-language broadcast templates.
 *
 * A campus emergency broadcast that only speaks English excludes the support
 * staff, contractors, and visitors who are often nearest the hazard. On a KIIT
 * campus that means Hindi and Odia alongside English, and it means the
 * *translation is authored*, not machine-generated at 3am — a mistranslated
 * evacuation instruction is worse than no instruction.
 *
 * Templates take a single `{place}` slot so a dispatcher fills one field and
 * every language stays correct.
 */

export type LanguageCode = 'en' | 'hi' | 'or'

export interface Language {
  code: LanguageCode
  /** Name in the language itself, as a speaker would recognise it. */
  label: string
}

export const BROADCAST_LANGUAGES: readonly Language[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
]

export interface BroadcastTemplate {
  id: string
  /** What a dispatcher is looking for under pressure. */
  label: string
  category: IncidentCategory | 'general'
  severity: Severity
  text: Record<LanguageCode, string>
}

/**
 * The pre-written broadcasts. Each is a complete, sendable instruction — the
 * dispatcher's job is to choose and fill the place, not to compose prose while
 * an alarm is going off.
 */
export const BROADCAST_TEMPLATES: readonly BroadcastTemplate[] = [
  {
    id: 'fire-evacuate',
    label: 'Fire — evacuate now',
    category: 'fire',
    severity: 'P0',
    text: {
      en: 'FIRE at {place}. Evacuate immediately by the nearest stairwell. Do not use lifts.',
      hi: '{place} में आग। तुरंत निकटतम सीढ़ी से बाहर निकलें। लिफ्ट का प्रयोग न करें।',
      or: '{place}ରେ ନିଆଁ। ତୁରନ୍ତ ନିକଟତମ ସିଡ଼ି ବାଟେ ବାହାରି ଯାଆନ୍ତୁ। ଲିଫ୍ଟ ବ୍ୟବହାର କରନ୍ତୁ ନାହିଁ।',
    },
  },
  {
    id: 'shelter-in-place',
    label: 'Security — stay inside',
    category: 'security',
    severity: 'P0',
    text: {
      en: 'SECURITY ALERT near {place}. Stay inside, lock the door, and wait for the all-clear.',
      hi: '{place} के पास सुरक्षा चेतावनी। अंदर रहें, दरवाज़ा बंद करें और अगली सूचना की प्रतीक्षा करें।',
      or: '{place} ପାଖରେ ସୁରକ୍ଷା ସତର୍କତା। ଭିତରେ ରୁହନ୍ତୁ, ଦ୍ୱାର ବନ୍ଦ କରନ୍ତୁ ଏବଂ ପରବର୍ତ୍ତୀ ସୂଚନା ଅପେକ୍ଷା କରନ୍ତୁ।',
    },
  },
  {
    id: 'medical-clear-route',
    label: 'Medical — clear the route',
    category: 'medical',
    severity: 'P1',
    text: {
      en: 'Medical emergency at {place}. Keep corridors and the approach road clear for responders.',
      hi: '{place} पर चिकित्सा आपात स्थिति। गलियारे और पहुँच मार्ग खाली रखें।',
      or: '{place}ରେ ଚିକିତ୍ସା ଜରୁରୀ ଅବସ୍ଥା। କରିଡର ଏବଂ ପ୍ରବେଶ ରାସ୍ତା ଖାଲି ରଖନ୍ତୁ।',
    },
  },
  {
    id: 'infrastructure-avoid',
    label: 'Hazard — avoid the area',
    category: 'infrastructure',
    severity: 'P2',
    text: {
      en: 'Hazard at {place}. Avoid the area until maintenance clears it.',
      hi: '{place} पर खतरा। रखरखाव दल की सूचना तक इस क्षेत्र से दूर रहें।',
      or: '{place}ରେ ବିପଦ। ରକ୍ଷଣାବେକ୍ଷଣ ଦଳ ନ କହିବା ପର୍ଯ୍ୟନ୍ତ ଏହି ଅଞ୍ଚଳକୁ ଏଡ଼ାନ୍ତୁ।',
    },
  },
  {
    id: 'all-clear',
    label: 'All clear',
    category: 'general',
    severity: 'P3',
    text: {
      en: 'ALL CLEAR at {place}. Normal access has resumed. Thank you for cooperating.',
      hi: '{place} पर स्थिति सामान्य। सामान्य आवागमन शुरू। सहयोग के लिए धन्यवाद।',
      or: '{place}ରେ ପରିସ୍ଥିତି ସ୍ୱାଭାବିକ। ସାଧାରଣ ଯାତାୟାତ ଆରମ୍ଭ। ସହଯୋଗ ପାଇଁ ଧନ୍ୟବାଦ।',
    },
  },
]

/**
 * Fills a template's `{place}` slot for one language.
 *
 * @example
 * renderTemplate(BROADCAST_TEMPLATES[0], 'en', 'Block C')
 * // => 'FIRE at Block C. Evacuate immediately by the nearest stairwell. Do not use lifts.'
 */
export function renderTemplate(
  template: BroadcastTemplate,
  language: LanguageCode,
  place: string,
): string {
  return template.text[language].replaceAll('{place}', place)
}

/**
 * All three languages of one template, joined for a single multilingual
 * broadcast — one message that everyone on campus can read some part of,
 * rather than three separate alerts competing for the same screen.
 *
 * @example
 * renderAllLanguages(template, 'Block C').split(' · ').length // => 3
 */
export function renderAllLanguages(template: BroadcastTemplate, place: string): string {
  return BROADCAST_LANGUAGES.map((language) =>
    renderTemplate(template, language.code, place),
  ).join(' · ')
}

/**
 * Templates ordered for one incident: exact category matches first, then
 * general-purpose ones. Nothing is hidden, because the dispatcher may know
 * something the category field does not.
 *
 * @example
 * templatesFor('fire')[0].id // => 'fire-evacuate'
 */
export function templatesFor(category: IncidentCategory): BroadcastTemplate[] {
  return [...BROADCAST_TEMPLATES].sort((a, b) => {
    const rank = (template: BroadcastTemplate) =>
      template.category === category ? 0 : template.category === 'general' ? 1 : 2
    return rank(a) - rank(b)
  })
}

/**
 * Which language a broadcast is written in, read from its script.
 *
 * Devanagari and Odia have their own Unicode blocks, so the script is a
 * reliable signal and needs no word list. This exists so a dispatcher who
 * loads the Hindi template and presses announce hears Hindi — the language
 * is one less thing to get right under pressure.
 *
 * @example
 * detectLanguage('ଅଗ୍ନିକାଣ୍ଡ')       // => 'or'
 * detectLanguage('आग लगी है')        // => 'hi'
 * detectLanguage('Fire in B Block')  // => 'en'
 */
export function detectLanguage(text: string): LanguageCode {
  if (/[଀-୿]/.test(text)) return 'or'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'
  return 'en'
}
