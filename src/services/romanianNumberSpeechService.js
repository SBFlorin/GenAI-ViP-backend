function underTwentyToWords(n) {
  const words = {
    0: 'zero',
    1: 'unu',
    2: 'doi',
    3: 'trei',
    4: 'patru',
    5: 'cinci',
    6: 'sase',
    7: 'sapte',
    8: 'opt',
    9: 'noua',
    10: 'zece',
    11: 'unsprezece',
    12: 'douasprezece',
    13: 'treisprezece',
    14: 'paisprezece',
    15: 'cincisprezece',
    16: 'saisprezece',
    17: 'saptesprezece',
    18: 'optsprezece',
    19: 'nouasprezece'
  };
  return words[n];
}

function tensToWords(n) {
  const tens = {
    20: 'douazeci',
    30: 'treizeci',
    40: 'patruzeci',
    50: 'cincizeci',
    60: 'saizeci',
    70: 'saptezeci',
    80: 'optzeci',
    90: 'nouazeci'
  };
  return tens[n];
}

function numberToRomanianWords(num) {
  const n = Number(num);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(num);

  if (n < 20) return underTwentyToWords(n);
  if (n < 100) {
    const t = Math.floor(n / 10) * 10;
    const u = n % 10;
    return u === 0 ? tensToWords(t) : `${tensToWords(t)} si ${underTwentyToWords(u)}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let hundredsWord = '';
    if (h === 1) hundredsWord = 'o suta';
    else if (h === 2) hundredsWord = 'doua sute';
    else hundredsWord = `${underTwentyToWords(h)} sute`;
    return rem === 0 ? hundredsWord : `${hundredsWord} ${numberToRomanianWords(rem)}`;
  }

  const th = Math.floor(n / 1000);
  const rem = n % 1000;
  let thousandsWord = '';
  if (th === 1) thousandsWord = 'o mie';
  else if (th === 2) thousandsWord = 'doua mii';
  else thousandsWord = `${numberToRomanianWords(th)} mii`;
  return rem === 0 ? thousandsWord : `${thousandsWord} ${numberToRomanianWords(rem)}`;
}

function stripParenthesizedDigits(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\s*\(\s*\d{1,4}\s*\)/g, '');
}

const PATIENT_FORBIDDEN_REPLY_PATTERNS = [
  /cum\s+sunte[tț]i/i,
  /cum\s+v[ăa]\s+pot\s+ajuta/i,
  /cu\s+ce\s+v[ăa]\s+pot\s+ajuta/i,
  /ce\s+dori[tț]i\s+s[ăa]\s+discut/i,
  /cu\s+ce\s+v[ăa]\s+pot\s+fi\s+de\s+folos/i,
  /ce\s+problema\s+av(e|ă)ți/i,
  /pot\s+s[aă]\s+(te|v[aă])\s+ajuta\s+cu\s+informa/i,
  /nu\s+pot\s+genera.*imagini/i,
  /nu\s+pot\s+afi[sș]a.*imagini/i,
  /sunt\s+aici\s+s[aă]\s+(te|v[aă])\s+ajut/i,
  /v[ăa]\s+rug[aă]m\s+s[aă]\s+preciza[tț]i.*forma\s+de\s+adresare/i,
  /forma\s+de\s+adresare\s+corespunz[aă]toare\s+sexului/i,
  /\(domnul\s+doctor\s+sau\s+doamna\s+doctor\)/i
];

const NEVER_SMOKED_CLAIM_PATTERNS = [
  /\bniciodat[aă]\b/i,
  /nu\s+am\s+fumat\s+niciodat/i,
  /nu\s+am\s+fumat\s+deloc/i,
  /nu\s+fumez\s+și\s+nu\s+am\s+fumat/i
];

const MOTIVATED_TO_QUIT_PATTERNS = [
  /sunt\s+(destul\s+de\s+)?încrezător.*renunț/i,
  /sunt\s+(destul\s+de\s+)?increzator.*renunt/i,
  /voi\s+reuși.*(las|lăsa|renunț|renunt)/i,
  /sunt\s+hotărât.*(schimbare|renunț|renunt|sănătate)/i,
  /sunt\s+hotarat.*(schimbare|renunt|sanatate)/i,
  /plan\s+bine\s+pus\s+la\s+punct/i,
  /sunt\s+deschis.*(plan|renunț|renunt)/i,
  /sunt\s+deschisă.*(plan|renunț|renunt)/i,
  /aș\s+aprecia\s+recomandările/i,
  /as\s+aprecia\s+recomandarile/i,
  /voi\s+reuși\s+să\s+mă\s+las\s+de\s+fumat/i,
  /aveți\s+dreptate.*(renunț|renunt|las)/i,
  /aveti\s+dreptate.*(renunt|las)/i,
  /m-?ați\s+convins/i,
  /ma\s+convins/i,
  /sunt\s+de\s+acord\s+(să\s+)?(mă\s+las|renunț|renunt)/i,
  /poate\s+ar\s+trebui\s+să\s+(mă\s+las|renunț|renunt)/i,
  /voi\s+încerca\s+să\s+(mă\s+las|renunț|renunt)/i,
  /voi\s+incerca\s+să\s+(mă\s+las|renunt)/i,
  /sunt\s+gata\s+să\s+(mă\s+las|renunț|renunt)/i,
  /accept\s+(să\s+)?(renunț|renunt|plan)/i,
  /(?<!nu\s)vreau\s+să\s+(mă\s+las|renunț|renunt)/i,
  /mă\s+hotărăsc\s+să\s+(mă\s+las|renunț|renunt)/i,
  /ma\s+hotarasc\s+să\s+(mă\s+las|renunt)/i,
  /renunț\s+(de\s+)?mâine/i,
  /renunt\s+(de\s+)?maine/i,
  /bine,?\s+(ok|da|poate).{0,40}(renunț|renunt|mă\s+las|ma\s+las)/i
];

const FEMININE_TO_MASCULINE_SELF = [
  [/interesată/gi, 'interesat'],
  [/deschisă/gi, 'deschis'],
  [/obosită/gi, 'obosit'],
  [/programată/gi, 'programat'],
  [/convinsă/gi, 'convins'],
  [/hotărâtă/gi, 'hotărât'],
  [/fumătoare/gi, 'fumător'],
  [/obişnuită/gi, 'obişnuit'],
  [/obisnuită/gi, 'obisnuit'],
  [/avocată/gi, 'avocat']
];

// (?!ă) avoids matching the masculine stem inside an already-feminine word
// (e.g. "interesată" → must not become "interesatăă"); JS \w does not include "ă".
const MASCULINE_TO_FEMININE_SELF = [
  [/\binteresat(?!ă)/gi, 'interesată'],
  [/\bdeschis(?!ă)/gi, 'deschisă'],
  [/\bobosit(?!ă)/gi, 'obosită'],
  [/\bprogramat(?!ă)/gi, 'programată'],
  [/\bconvins(?!ă)/gi, 'convinsă'],
  [/\bhotărât(?!ă)/gi, 'hotărâtă'],
  [/\bfumător(?!oare)/gi, 'fumătoare'],
  [/\bobişnuit(?!ă)/gi, 'obişnuită'],
  [/\bobisnuit(?!ă)/gi, 'obisnuită'],
  [/\bavocat(?!ă)/gi, 'avocată']
];

const ENGLISH_OCCUPATION_PATTERNS = [
  /\bSoftware Engineer\b/gi,
  /\bCorporate Attorney\b/gi,
  /\bReal Estate Agent\b/gi,
  /\bSous Chef\b/gi,
  /\bHigh School Teacher\b/gi,
  /\bFootball Coach\b/gi,
  /\bTIR Driver\b/gi,
  /\bLong-Haul Trucker\b/gi,
  /\bConstruction Foreman\b/gi,
  /\bGraphic Designer\b/gi,
  /\bCaregiver\b/gi,
  /\bElementary School Teacher\b/gi,
  /\bFormer Carpenter\b/gi
];

function sanitizePatientOccupationReply(text, occupationReply) {
  if (!text || typeof text !== 'string' || !occupationReply) {
    return text;
  }

  const hasEnglishOccupation = ENGLISH_OCCUPATION_PATTERNS.some((pattern) => pattern.test(text));
  const looksLikeEnglishJobTitle = /^Sunt\s+[A-Z][a-zA-Z\s&]+\.?$/.test(text.trim());

  if (hasEnglishOccupation || looksLikeEnglishJobTitle) {
    return occupationReply;
  }

  return text;
}

function sanitizePatientReplyByGender(text, gender) {
  if (!text || typeof text !== 'string' || !gender) {
    return text;
  }

  const replacements = gender === 'femeie' ? MASCULINE_TO_FEMININE_SELF : FEMININE_TO_MASCULINE_SELF;
  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function buildUninterestedQuitterReply(gender, patientSnapshot = null) {
  const narrative = (patientSnapshot?.smokingHistoryNarrative || '').toLowerCase();
  const isFeminine = gender === 'femeie';

  if (narrative.includes('does not perceive')) {
    return isFeminine
      ? 'Nu, nu sunt interesată să mă las de fumat acum. Nu percep fumatul ca pe o problemă pentru mine.'
      : 'Nu, nu sunt interesat să mă las de fumat acum. Nu percep fumatul ca pe o problemă pentru mine.';
  }
  if (narrative.includes('not ready')) {
    return isFeminine
      ? 'Înțeleg ce spuneți, doamnă doctor, dar nu sunt pregătită să renunț acum.'
      : 'Înțeleg ce spuneți, domnule doctor, dar nu sunt pregătit să renunț acum.';
  }
  if (narrative.includes('fatalistic')) {
    return isFeminine
      ? 'Fumez de foarte mulți ani și, sincer, nu cred că mai are rost să renunț acum. Nu sunt interesată să încerc.'
      : 'Fumez de foarte mulți ani și, sincer, nu cred că mai are rost să renunț acum. Nu sunt interesat să încerc.';
  }
  if (narrative.includes('minimizes personal risk')) {
    return isFeminine
      ? 'Știu ce se spune despre fumat în general, dar pentru mine nu e o problemă atât de mare — fumez puțin și nu simt că m-ar afecta cu adevărat. Nu sunt interesată să renunț acum.'
      : 'Știu ce se spune despre fumat în general, dar pentru mine nu e o problemă atât de mare — fumez puțin și nu simt că m-ar afecta cu adevărat. Nu sunt interesat să renunț acum.';
  }
  if (narrative.includes('confident in ability') && narrative.includes('unwilling')) {
    return isFeminine
      ? 'Cred că aș putea renunța dacă m-aș hotărî, dar acum pur și simplu nu sunt interesată. Nu e vorba de lipsă de încredere — nu vreau să renunț.'
      : 'Cred că aș putea renunța dacă m-aș hotărî, dar acum pur și simplu nu sunt interesat. Nu e vorba de lipsă de încredere — nu vreau să renunț.';
  }
  if (narrative.includes('prioritizes quality of life')) {
    return isFeminine
      ? 'Recunosc că fumatul are riscuri pentru sănătate, dar pentru mine calitatea vieții contează mai mult — face parte din rutina mea și nu vreau să renunț acum.'
      : 'Recunosc că fumatul are riscuri pentru sănătate, dar pentru mine calitatea vieții contează mai mult — face parte din rutina mea și nu vreau să renunț acum.';
  }

  return isFeminine
    ? 'Nu, nu sunt interesată să mă las de fumat acum. Nu mă gândesc la renunțare în momentul ăsta.'
    : 'Nu, nu sunt interesat să mă las de fumat acum. Nu mă gândesc la renunțare în momentul ăsta.';
}

const PERSONAL_RISK_ALARM_PATTERNS = [
  /sunt\s+(foarte\s+)?îngrijorat/i,
  /sunt\s+(foarte\s+)?ingrijorat/i,
  /risc\s+(mare|serios|ridicat)\s+pentru\s+mine/i,
  /îmi\s+face\s+(foarte\s+)?(mult\s+)?rău/i,
  /imi\s+face\s+(foarte\s+)?(mult\s+)?rau/i,
  /știu\s+că\s+(îmi\s+)?(face|afectează)\s+(rău|grav)/i
];

const MINIMIZE_RISK_PATTERNS = [
  /pentru\s+mine\s+nu/i,
  /nu\s+e\s+(o\s+)?problemă\s+(mare\s+)?pentru\s+mine/i,
  /nu\s+e\s+(o\s+)?problema\s+(mare\s+)?pentru\s+mine/i,
  /fumez\s+puțin/i,
  /fumez\s+putin/i,
  /nu\s+m[aă]\s+afectează/i,
  /nu\s+ma\s+afecteaza/i,
  /nu\s+simt\s+că/i,
  /nu\s+simt\s+ca/i,
  /exagerat/i,
  /știu.*dar.*pentru\s+mine/i,
  /stiu.*dar.*pentru\s+mine/i,
  /la\s+mine\s+nu\s+e/i
];

function correctMinimizesPersonalRiskReply(text, patientSnapshot, gender = null) {
  if (!text || typeof text !== 'string' || patientSnapshot?.quitMotivation !== 'uninterested') {
    return text;
  }

  const narrative = (patientSnapshot.smokingHistoryNarrative || '').toLowerCase();
  if (!narrative.includes('minimizes personal risk')) {
    return text;
  }

  const hasMinimize = MINIMIZE_RISK_PATTERNS.some((pattern) => pattern.test(text));
  const hasAlarm = PERSONAL_RISK_ALARM_PATTERNS.some((pattern) => pattern.test(text));
  const discussesRisk = /\b(risc|pericol|afecteaz|afecteaza|sănătate|sanatate|bolnav|cancer)\b/i.test(
    text
  );

  if ((hasAlarm && !hasMinimize) || (discussesRisk && !hasMinimize && text.length > 70)) {
    const effectiveGender = gender || patientSnapshot?.sex || null;
    return buildUninterestedQuitterReply(effectiveGender, patientSnapshot);
  }

  return text;
}

const NOT_INTERESTED_TO_QUIT_PATTERNS = [
  /nu\s+sunt\s+interesat(ă)?\s+să\s+(mă\s+las|renunț|renunt)/i,
  /nu\s+vreau\s+să\s+(mă\s+las|renunț|renunt)/i,
  /nu\s+mă\s+gândesc\s+să\s+renunț/i,
  /nu\s+ma\s+gandesc\s+sa\s+renunt/i,
  /nu\s+cred\s+că\s+vreau\s+să\s+renunț/i,
  /nu\s+intenționez\s+să\s+renunț/i,
  /nu\s+intentionez\s+sa\s+renunt/i
];

const HIGH_CONFIDENCE_QUIT_PATTERNS = [
  /sunt\s+(foarte\s+)?încrezător\s+că\s+voi\s+reuși/i,
  /sunt\s+(foarte\s+)?increzator\s+ca\s+voi\s+reusi/i,
  /fără\s+probleme\s+.*renunț/i,
  /sigur\s+că\s+voi\s+reuși/i,
  /nu\s+am\s+nicio\s+teamă\s+de\s+sevraj/i,
  /nu\s+am\s+nicio\s+teamă/i
];

function buildInterestedQuitterReply(gender, patientSnapshot = null) {
  const isFeminine = gender === 'femeie';
  const narrative = (patientSnapshot?.smokingHistoryNarrative || '').toLowerCase();
  const lowConfidence = patientSnapshot?.confidenceLevel === 'Low';

  if (lowConfidence || narrative.includes('afraid of withdrawal')) {
    if (narrative.includes('children/family')) {
      return isFeminine
        ? 'Da, aș vrea să renunț — mai ales pentru copii și familie — dar sunt îngrijorată: mi-e teamă de sevraj și nu sunt sigură că aș reuși ușor.'
        : 'Da, aș vrea să renunț — mai ales pentru copii și familie — dar sunt îngrijorat: mi-e teamă de sevraj și nu sunt sigur că aș reuși ușor.';
    }
    return isFeminine
      ? 'Da, aș vrea să renunț, dar sunt destul de îngrijorată — mi-e teamă de sevraj și nu sunt sigură că aș reuși ușor.'
      : 'Da, aș vrea să renunț, dar sunt destul de îngrijorat — mi-e teamă de sevraj și nu sunt sigur că aș reuși ușor.';
  }
  if (narrative.includes('physical performance')) {
    return isFeminine
      ? 'Da, sunt interesată să renunț — simt că fumatul îmi afectează condiția fizică și aș vrea să mă simt mai bine.'
      : 'Da, sunt interesat să renunț — simt că fumatul îmi afectează condiția fizică și aș vrea să mă simt mai bine.';
  }
  if (narrative.includes('children/family')) {
    return isFeminine
      ? 'Da, m-aș gândi serios să renunț — mai ales pentru copii și familie.'
      : 'Da, m-aș gândi serios să renunț — mai ales pentru copii și familie.';
  }
  return isFeminine
    ? 'Da, sunt interesată să renunț la fumat și aș fi deschisă la recomandările dumneavoastră.'
    : 'Da, sunt interesat să renunț la fumat și aș fi deschis la recomandările dumneavoastră.';
}

function correctInterestedSmokerReply(text, patientSnapshot, gender = null) {
  if (!text || typeof text !== 'string' || patientSnapshot?.quitMotivation !== 'interested') {
    return text;
  }

  if (!NOT_INTERESTED_TO_QUIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }

  const effectiveGender = gender || patientSnapshot?.sex || null;
  return buildInterestedQuitterReply(effectiveGender, patientSnapshot);
}

function correctInterestedLowConfidenceReply(text, patientSnapshot, gender = null) {
  if (
    !text ||
    typeof text !== 'string' ||
    patientSnapshot?.quitMotivation !== 'interested' ||
    patientSnapshot?.confidenceLevel !== 'Low'
  ) {
    return text;
  }

  if (!HIGH_CONFIDENCE_QUIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }

  const effectiveGender = gender || patientSnapshot?.sex || null;
  return buildInterestedQuitterReply(effectiveGender, patientSnapshot);
}

const LOW_QUIT_CONFIDENCE_CLAIM_PATTERNS = [
  /încredere\s+scăzut/i,
  /incredere\s+scazut/i,
  /nu\s+cred\s+că\s+aș\s+reuși/i,
  /nu\s+cred\s+ca\s+as\s+reusi/i,
  /nu\s+sunt\s+sigur.*renunț/i,
  /nu\s+sunt\s+sigur.*renunt/i,
  /nu\s+aș\s+reuși\s+să\s+renunț/i,
  /nu\s+as\s+reusi\s+sa\s+renunt/i,
  /nu\s+am\s+încredere\s+(că\s+)?aș\s+reuși/i,
  /mi-e\s+imposibil\s+să\s+renunț/i
];

const QUALITY_OF_LIFE_PATTERNS = [
  /calitatea\s+vieț/i,
  /calitatea\s+viet/i,
  /calitate.*vie/i,
  /stilului\s+meu\s+de\s+viață/i,
  /stilului\s+meu\s+de\s+viata/i,
  /mă\s+relax/i,
  /ma\s+relax/i,
  /rutina\s+me/i,
  /prefer\s+să\s+păstrez/i,
  /prefer\s+sa\s+pastrez/i
];

function correctPrioritizesQualityOfLifeReply(text, patientSnapshot, gender = null) {
  if (!text || typeof text !== 'string' || !patientSnapshot?.prioritizesQualityOfLife) {
    return text;
  }

  const hasQualityOfLife = QUALITY_OF_LIFE_PATTERNS.some((pattern) => pattern.test(text));
  const discussesRiskOrQuit = /\b(risc|pericol|renunț|renunt|sănătate|sanatate|fumat|las de fumat)\b/i.test(
    text
  );

  if (discussesRiskOrQuit && !hasQualityOfLife && text.length > 35) {
    const effectiveGender = gender || patientSnapshot?.sex || null;
    return buildUninterestedQuitterReply(effectiveGender, patientSnapshot);
  }

  return text;
}

function correctConfidentButUnwillingReply(text, patientSnapshot, gender = null) {
  if (!text || typeof text !== 'string' || !patientSnapshot?.confidentButUnwilling) {
    return text;
  }

  if (!LOW_QUIT_CONFIDENCE_CLAIM_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }

  const effectiveGender = gender || patientSnapshot?.sex || null;
  return buildUninterestedQuitterReply(effectiveGender, patientSnapshot);
}

function correctUninterestedSmokerReply(text, patientSnapshot, gender = null) {
  if (!text || typeof text !== 'string' || patientSnapshot?.quitMotivation !== 'uninterested') {
    return text;
  }

  if (!MOTIVATED_TO_QUIT_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }

  const effectiveGender = gender || patientSnapshot?.sex || null;
  return buildUninterestedQuitterReply(effectiveGender, patientSnapshot);
}

function correctFormerSmokerReply(text, patientSnapshot) {
  if (!text || typeof text !== 'string' || !patientSnapshot?.formerSmoker) {
    return text;
  }

  if (!NEVER_SMOKED_CLAIM_PATTERNS.some((pattern) => pattern.test(text))) {
    return text;
  }

  const narrative = (patientSnapshot.smokingHistoryNarrative || '').toLowerCase();
  if (narrative.includes('quit recently')) {
    return 'Nu, nu am fumat de ieri. Am renunțat recent și încerc să rămân nefumător.';
  }
  if (narrative.includes('heavy smoker')) {
    return 'Nu, nu fumez acum. Am fumat mult în trecut, dar am renunțat după o problemă de sănătate.';
  }
  if (narrative.includes('light smoker')) {
    return 'Nu, nu fumez acum. Am fumat puțin în trecut, dar am renunțat recent.';
  }
  return 'Nu, nu fumez acum. Am fumat în trecut, dar am renunțat și încerc să rămân abstinent.';
}

function sanitizePatientReply(
  text,
  fallbackGreeting = 'Bună ziua, domnule doctor.',
  gender = null,
  occupationReply = null,
  patientSnapshot = null
) {
  if (!text || typeof text !== 'string') return text;

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const kept = sentences.filter(
    (sentence) => !PATIENT_FORBIDDEN_REPLY_PATTERNS.some((pattern) => pattern.test(sentence))
  );

  let result = kept.join(' ').trim();
  if (!result) {
    result = fallbackGreeting;
  }

  result = result.replace(/\s{2,}/g, ' ').trim();
  result = sanitizePatientReplyByGender(result, gender);
  result = sanitizePatientOccupationReply(result, occupationReply);
  result = correctFormerSmokerReply(result, patientSnapshot);
  result = correctInterestedSmokerReply(result, patientSnapshot, gender);
  result = correctInterestedLowConfidenceReply(result, patientSnapshot, gender);
  result = correctUninterestedSmokerReply(result, patientSnapshot, gender);
  result = correctMinimizesPersonalRiskReply(result, patientSnapshot, gender);
  result = correctConfidentButUnwillingReply(result, patientSnapshot, gender);
  return correctPrioritizesQualityOfLifeReply(result, patientSnapshot, gender);
}

function normalizeNumbersForRomanianTTS(text) {
  if (!text || typeof text !== 'string') return text;

  const withoutNumericParens = stripParenthesizedDigits(text);

  // Convert simple integer tokens (ages, years, counts) to words.
  // Keeps punctuation around numbers intact.
  return withoutNumericParens.replace(/\b\d{1,4}\b/g, (match) => numberToRomanianWords(match));
}

module.exports = {
  normalizeNumbersForRomanianTTS,
  stripParenthesizedDigits,
  sanitizePatientReply,
  sanitizePatientReplyByGender,
  sanitizePatientOccupationReply,
  correctFormerSmokerReply,
  correctInterestedSmokerReply,
  correctInterestedLowConfidenceReply,
  buildInterestedQuitterReply,
  correctUninterestedSmokerReply,
  correctMinimizesPersonalRiskReply,
  correctConfidentButUnwillingReply,
  correctPrioritizesQualityOfLifeReply,
  buildUninterestedQuitterReply
};

