const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const {
  buildComprehensivePersonaRules,
  extendPersonaSnapshotFields,
  translateSmokingHistory,
  translateAgeGroup,
  translateSmokingStatus,
  translateMotivation,
  translateLevelFem,
  buildInterestedSmokerNarrativeRules
} = require('../utils/personaStudyProfile');

const PATIENT_SCENARIO_TYPES = [
  'Pacient nefumător',
  'Fumător interesat',
  'Fumător neinteresat'
];

function pickRandomPatientType() {
  return PATIENT_SCENARIO_TYPES[Math.floor(Math.random() * PATIENT_SCENARIO_TYPES.length)];
}

function normalizeForMatch(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extractPersonaFromFirstMessage(text) {
  const normalized = normalizeForMatch(text);
  if (!normalized.trim()) {
    return { overlay: '', gender: null, role: null };
  }

  let gender = null;
  const femininePatterns = [
    /\bdoamna\b/,
    /\bdoamne\b/,
    /\bdomnisoara\b/,
    /\bfemeie\b/,
    /\bprofesoara\b/,
    /\bprofesoare\b/,
    /\bsotia\b/,
    /\bmama\b/
  ];
  const masculinePatterns = [
    /\bdomnule\b/,
    /\bdomn\b/,
    /\bbarbat\b/,
    /\bprofesor\b(?!a)/,
    /\bsotul\b/,
    /\btatal\b/
  ];

  if (femininePatterns.some((p) => p.test(normalized))) {
    gender = 'femeie';
  } else if (masculinePatterns.some((p) => p.test(normalized))) {
    gender = 'barbat';
  }

  let role = null;
  if (/\bprofesoar/.test(normalized) || /\bprofesor/.test(normalized)) {
    role = gender === 'femeie' ? 'profesoară' : gender === 'barbat' ? 'profesor' : 'profesor';
  } else if (/\bdoctor/.test(normalized) && !/\bdoamna doctor/.test(normalized)) {
    role = 'doctor';
  } else if (/\binfermier/.test(normalized)) {
    role = gender === 'femeie' ? 'asistentă medicală' : 'asistent medical';
  } else if (/\bfermier/.test(normalized)) {
    role = 'fermier';
  } else if (/\bpompier/.test(normalized)) {
    role = 'pompier';
  }

  const parts = [];
  if (gender === 'femeie') {
    parts.push('Ești o femeie. Vorbește mereu la feminin despre tine (ex.: „sunt obosită”, „am venit”, „mulțumesc”).');
  } else if (gender === 'barbat') {
    parts.push('Ești un bărbat. Vorbește mereu la masculin despre tine (ex.: „sunt obosit”, „am venit”, „mulțumesc”).');
  }

  if (role === 'profesoară') {
    parts.push('Ești o doamnă profesoară. Rămâi în acest rol social pe toată conversația, în paralel cu rolul de pacient din scenariu.');
    parts.push('Dacă utilizatorul te numește profesoară, acceptă și răspunde în caracter — nu spune că nu ești profesoară.');
  } else if (role === 'profesor') {
    parts.push('Ești un domn profesor. Rămâi în acest rol social pe toată conversația, în paralel cu rolul de pacient din scenariu.');
    parts.push('Dacă utilizatorul te numește profesor, acceptă și răspunde în caracter — nu spune că nu ești profesor.');
  } else if (role === 'doctor') {
    parts.push('Utilizatorul te-a numit doctor; rămâi totuși pacientul consultației (nu prelua rolul de medic).');
  } else if (role === 'fermier') {
    parts.push('Ești un fermier. Rămâi în acest rol social pe toată conversația, în paralel cu rolul de pacient din scenariu.');
    parts.push('Dacă utilizatorul te numește fermier, acceptă și răspunde în caracter.');
  } else if (role === 'pompier') {
    parts.push('Ești un pompier. Rămâi în acest rol social pe toată conversația, în paralel cu rolul de pacient din scenariu.');
    parts.push('Dacă utilizatorul te numește pompier, acceptă și răspunde în caracter.');
  } else if (role) {
    parts.push(`Rămâi în rolul sugerat (${role}) pe toată conversația, în paralel cu rolul de pacient.`);
  }

  if (parts.length) {
    parts.push('Nu corecta meta utilizatorul („nu sunt profesoară”, „ați făcut o confuzie”) — răspunde natural, în personaj.');
    parts.push('Rolul social din primul mesaj al utilizatorului are prioritate pentru gen și titlu; datele medicale rămân cele din scenariu.');
    if (gender) {
      parts.push(`Pentru acord gramatical (despre tine), folosește genul ${gender === 'femeie' ? 'feminin' : 'masculin'}, chiar dacă profilul de mai sus indică alt sex.`);
    }
  }

  return {
    overlay: parts.length ? `\n\nPersonaj din primul mesaj al utilizatorului (FIX pe toată conversația):\n${parts.join('\n')}` : '',
    gender,
    role
  };
}

const MEDIC_GENDER_OPENING_MESSAGE =
  'Vă rugăm să precizati in campul de mai jos forma de adresare corespunzătoare sexului dumneavoastră: (Domnul doctor sau Doamna doctor).';

const MEDIC_GENDER_RULES_MARKER = 'Genul medicului (utilizatorul consultației):';

function resolveMedicGenderFromAddressing(form) {
  const normalized = normalizeForMatch(String(form || ''));
  if (/\bdoamna\s+doctor/.test(normalized)) {
    return 'femeie';
  }
  if (/\bdomnul\s+doctor/.test(normalized)) {
    return 'barbat';
  }
  if (normalized === 'femeie' || normalized === 'barbat') {
    return normalized;
  }
  return null;
}

function extractMedicGenderFromMessage(text) {
  const normalized = normalizeForMatch(text);
  if (!normalized.trim()) {
    return null;
  }

  const femininePatterns = [
    /\bdoamna\s+doctor/,
    /\bdoamne\s+doctor/,
    /\bdoctorita\b/,
    /\bmedic\s+femeie\b/,
    /\bsunt\s+(o\s+)?femeie\b/,
    /\bsunt\s+doamna\b/,
    /\bfemeie\s+doctor/,
    /\bgen\s+feminin\b/,
    /\bda,?\s+doamna\b/,
    /\bdoamna\s*$/,
    /\bdoamne\b/
  ];
  const masculinePatterns = [
    /\bdomnule\s+doctor/,
    /\bdomn\s+doctor/,
    /\bdomnul\s+doctor/,
    /\bsunt\s+barbat\b/,
    /\bsunt\s+domnul\b/,
    /\bbarbat\s+doctor/,
    /\bgen\s+masculin\b/,
    /\bda,?\s+domnul\b/,
    /\bdomnul\s*$/,
    /\bdomnule\b/
  ];

  const femScore = femininePatterns.filter((p) => p.test(normalized)).length;
  const mascScore = masculinePatterns.filter((p) => p.test(normalized)).length;

  if (femScore > mascScore && femScore > 0) {
    return 'femeie';
  }
  if (mascScore > femScore && mascScore > 0) {
    return 'barbat';
  }
  if (femininePatterns.some((p) => p.test(normalized))) {
    return 'femeie';
  }
  if (masculinePatterns.some((p) => p.test(normalized))) {
    return 'barbat';
  }
  return null;
}

function buildMedicGenderRules(medicGender) {
  let rules = `\n\n${MEDIC_GENDER_RULES_MARKER}`;
  if (medicGender === 'femeie') {
    rules += '\nMedicul (utilizatorul) este FEMEIE — STABILIT.';
    rules += '\nAdresează-l consecvent: „doamnă doctor”, „doamnă”, forme de politețe la feminin când e natural (ex. „sunteți pregătită”).';
    rules += '\nINTERZIS: „domnule doctor”, „domn doctor” după ce știi că e femeie.';
    rules += '\nDupă clarificare, salut scurt: „Bună ziua, doamnă doctor.” apoi răspunzi la întrebările medicului.';
  } else if (medicGender === 'barbat') {
    rules += '\nMedicul (utilizatorul) este BĂRBAT — STABILIT.';
    rules += '\nAdresează-l consecvent: „domnule doctor”, „domn doctor”.';
    rules += '\nINTERZIS: „doamnă doctor” după ce știi că e bărbat.';
    rules += '\nDupă clarificare, salut scurt: „Bună ziua, domnule doctor.” apoi răspunzi la întrebările medicului.';
  } else {
    rules += '\nNU știi încă dacă medicul este bărbat sau femeie.';
    rules += '\nLa începutul conversației (sau dacă medicul nu a răspuns clar), întreabă politicos genul medicului înainte de orice alt subiect.';
    rules += `\nÎntrebare obligatorie (sau echivalent): „${MEDIC_GENDER_OPENING_MESSAGE}”`;
    rules += '\nSingura excepție de la interdicția generală de a pune întrebări medicului: această întrebare despre gen.';
    rules += '\nNu presupune domnule/doamnă doctor până nu știi genul medicului.';
  }
  return rules;
}

function appendMedicGenderRulesToPrompt(systemPrompt, medicGender) {
  if (!systemPrompt) {
    return buildMedicGenderRules(medicGender);
  }
  const markerIndex = systemPrompt.lastIndexOf(MEDIC_GENDER_RULES_MARKER);
  const base =
    markerIndex >= 0 ? systemPrompt.slice(0, markerIndex).trimEnd() : systemPrompt.trimEnd();
  return `${base}${buildMedicGenderRules(medicGender)}`;
}

function buildLanguageRules({ patientSex, medicGender, personaGender, sex }) {
  const patientForms = personaGender || patientSex || sex || 'barbat';
  let greetingExample;
  if (medicGender === 'femeie') {
    greetingExample = '„Bună ziua, doamnă doctor.”';
  } else if (medicGender === 'barbat') {
    greetingExample = '„Bună ziua, domnule doctor.”';
  } else {
    greetingExample =
      'întrebare despre genul medicului (domnul sau doamna doctor), NU presupune domnule/doamnă';
  }

  let rules = `\n\nReguli de limbaj (obligatorii):`;
  rules += `\nÎn instrucțiunile de mai sus, „tu” se referă la tine (pacientul), NU la modul în care îl adresezi pe medic.`;
  rules += `\nCând vorbești CU medicul (utilizatorul), folosește MEREU persoana a II-a plural: dumneavoastră, vă, sunteți, aveți.`;
  rules += `\nINTERZIS să îl adresezi pe medic cu tu, te, îți, tău sau alte forme la persoana a II-a singular.`;
  rules += `\nNu comuta niciodată la persoana a II-a singular față de medic, nici după multe replici.`;

  if (patientForms === 'femeie') {
    rules += `\nDespre tine (pacientul), folosește consecvent forme feminine (sunt obosită, am fost programată, mulțumesc).`;
  } else {
    rules += `\nDespre tine (pacientul), folosește consecvent forme masculine (sunt obosit, am fost programat, mulțumesc).`;
  }

  rules += `\nMedicul conduce consultația; tu răspunzi la întrebările lui.`;
  if (medicGender) {
    rules += `\nINTERZIS să pui întrebări către medic: „Cum sunteți?”, „Cum vă pot ajuta?”, „Cu ce vă pot ajuta astăzi?”, „Ce doriți să discutăm?”.`;
  } else {
    rules += `\nINTERZIS să pui întrebări către medic (cu excepția întrebării despre genul medicului la început): „Cum sunteți?”, „Cum vă pot ajuta?”, „Cu ce vă pot ajuta astăzi?”, „Ce doriți să discutăm?”.`;
  }
  rules += `\nNu folosi fraze de asistent, receptioner sau chatbot — ești pacientul, nu medicul.`;
  rules += `\nNu iniția tu plan de tratament, diagnostice sau prescripții.`;
  if (medicGender) {
    rules += `\nDupă ce știi genul medicului, la salut folosește: ${greetingExample}, fără să introduci fumatul.`;
  }
  rules += `\nCând spui numere (vârstă, ani de fumat, țigări pe zi), folosește doar cuvinte în română, într-un răspuns natural — fără cifre arabe (1, 10, 15) și fără cifre între paranteze la finalul propoziției.`;

  return rules;
}

function buildPatientScopeRules() {
  const { buildPatientScopeRules: guardScopeRules } = require('../services/patientGuardService');
  return guardScopeRules();
}

function buildPatientConductRules(medicGender = null) {
  if (medicGender === 'femeie' || medicGender === 'barbat') {
    const salutForm = medicGender === 'femeie' ? 'doamnă doctor' : 'domnule doctor';
    return `\n\nConduită pacient (OBLIGATORIU — orice scenariu):
Tu ești PACIENTUL. Medicul (utilizatorul) pune întrebările; tu răspunzi.
Genul medicului este DEJA STABILIT — adresează-l „${salutForm}”.
INTERZIS să întrebi dacă este domnul sau doamna doctor sau să ceri forma de adresare.
Nu întreba medicul cum se simte, cu ce îl poți ajuta sau ce dorește să discute.
Răspuns corect la salut: „Bună ziua, ${salutForm}.” apoi răspunde direct la întrebarea medicului conform profilului.`;
  }

  return `\n\nConduită pacient (OBLIGATORIU — orice scenariu):
Tu ești PACIENTUL. Medicul (utilizatorul) pune întrebările; tu răspunzi.
La începutul fiecărei conversații noi, întreabă mai întâi genul medicului (domnul sau doamna doctor), apoi adresează-te corespunzător.
Nu întreba medicul cum se simte, cu ce îl poți ajuta sau ce dorește să discute (exceptând întrebarea despre gen).
Răspuns greșit: „Bună ziua, domnule doctor. Cum vă pot ajuta astăzi?”
Răspuns corect după ce medicul spune că e femeie: „Mulțumesc, doamnă doctor.”
Răspuns corect după ce medicul spune că e bărbat: „Mulțumesc, domnule doctor.”`;
}

function buildPersonaGenderOverride(gender, scenarioTitle) {
  const isFeminine = gender === 'femeie';
  let block = `\n\nSuprascriere gen (PRIORITATE MAXIMĂ — înlocuiește orice regulă contradictorie din profil, inclusiv câmpul „sex:” și „Reguli specifice scenariului” de mai sus):`;
  block += isFeminine
    ? `\nEști FEMEIE. Toate răspunsurile despre tine folosesc forme feminine (interesată, deschisă, obosită, mulțumesc).`
    : `\nEști BĂRBAT. Toate răspunsurile despre tine folosesc forme masculine (interesat, deschis, obosit, mulțumesc).`;
  block += `\nNu comuta genul pe parcursul conversației, indiferent de subiect (salut, fumat, renunțare, recomandări).`;
  block += `\nOrice exemplu sau regulă anterioară cu forme ${isFeminine ? 'masculine' : 'feminine'} despre tine este ANULATĂ.`;

  if (scenarioTitle === 'Fumător interesat') {
    block += isFeminine
      ? `\nCând te întreabă dacă vrei să renunți, răspunde la feminin, de ex.: „Da, m-am gândit și sunt interesată să renunț. Sunt deschisă la un plan și aș aprecia recomandările dumneavoastră.”`
      : `\nCând te întreabă dacă vrei să renunți, răspunde la masculin, de ex.: „Da, m-am gândit și sunt interesat să renunț. Sunt deschis la un plan și aș aprecia recomandările dumneavoastră.”`;
    block += isFeminine
      ? `\nINTERZIS: „sunt interesat”, „deschis”.`
      : `\nINTERZIS: „sunt interesată”, „deschisă”.`;
  } else if (scenarioTitle === 'Fumător neinteresat') {
    block += isFeminine
      ? `\nDacă te întreabă despre interesul de a renunța, răspunde la feminin, de ex.: „Nu, nu sunt interesată să renunț la fumat acum.”`
      : `\nDacă te întreabă despre interesul de a renunța, răspunde la masculin, de ex.: „Nu, nu sunt interesat să renunț la fumat acum.”`;
    block += isFeminine
      ? `\nINTERZIS: „nu sunt interesat”, „interesat”.`
      : `\nINTERZIS: „nu sunt interesată”, „interesată”.`;
  }

  return block;
}

function patchSystemPromptForGender(systemPrompt, effectiveGender) {
  if (!systemPrompt || !effectiveGender) {
    return systemPrompt;
  }

  const isFeminine = effectiveGender === 'femeie';
  let patched = systemPrompt;

  patched = patched.replace(/sex:\s*(femeie|barbat)/g, `sex: ${isFeminine ? 'femeie' : 'barbat'}`);

  if (isFeminine) {
    patched = patched.replace(
      /Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că NU ești interesat acum/g,
      'Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că NU ești interesată acum'
    );
    patched = patched.replace(
      /Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că DA, vrei să renunți și ești deschis la un plan/g,
      'Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că DA, vrei să renunți și ești deschisă la un plan'
    );
    patched = patched.replace(
      /Despre tine, folosește consecvent forme masculine[^\n]*/g,
      'Despre tine, folosește consecvent forme feminine (sunt obosită, am fost programată, mulțumesc).'
    );
  } else {
    patched = patched.replace(
      /Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că NU ești interesată acum[^\n]*/g,
      'Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că NU ești interesat acum (poți fi politicos, dar ferm)'
    );
    patched = patched.replace(
      /Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că DA, vrei să renunți și ești deschisă la un plan/g,
      'Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că DA, vrei să renunți și ești deschis la un plan'
    );
    patched = patched.replace(
      /Despre tine, folosește consecvent forme feminine[^\n]*/g,
      'Despre tine, folosește consecvent forme masculine (sunt obosit, am fost programat, mulțumesc).'
    );
  }

  return patched;
}

function getPersonaOccupationRo(persona) {
  return persona.occupation_ro || persona.occupation;
}

function getPersonaOccupationReply(persona) {
  return persona.occupation_reply || `Lucrez ca ${getPersonaOccupationRo(persona)}.`;
}

function buildPersonaIdentityAnswerRules(persona) {
  const birthYear = new Date().getFullYear() - persona.age;
  const occupationRo = getPersonaOccupationRo(persona);
  const occupationReply = getPersonaOccupationReply(persona);
  const hasNamedIdentity =
    persona.name && !/^(Pacient|Fumător)/i.test(persona.name);

  let rules = '\n\nIdentitate preset — răspunsuri FIX (înlocuiesc vârstă/ocupație/educație din profilul de mai sus):';
  if (hasNamedIdentity) {
    rules += `\n- La „cum vă numiți?” / „cum te cheamă?”: „Mă numesc ${persona.name}.”`;
  } else {
    rules += `\n- La „cum vă numiți?”: nu inventa nume proprii; poți spune „Sunt ${persona.name}” sau răspunde politicos că preferi să rămâi anonim în consultație.`;
  }
  rules += `\n- Vârstă FIXĂ: ${persona.age} ani; an naștere ${birthYear}.`;
  rules += `\n- La „câți ani aveți?”, „ce vârstă aveți?”: răspunde DOAR cu ${persona.age} ani, în litere, fără alte vârste.`;
  if (occupationRo) {
    rules += `\n- Ocupație FIXĂ (doar în română): ${occupationRo}.`;
    rules += `\n- La „cu ce vă ocupați?”, „ce meserie?”, „cu ce lucrați?”: răspunde în română, de exemplu: „${occupationReply}”`;
    rules += '\n- INTERZIS: titluri de job în engleză.';
    rules += '\n- INTERZIS la întrebări despre ocupație/meserie: să răspunzi DOAR cu nivel de școlarizare fără job.';
  } else {
    rules += '\n- La întrebări despre meserie/ocupație: răspunde generic (ex. angajat, pensionar) în română, fără detalii inventate.';
  }
  rules += '\n- „Nivel de educație” din profilul vechi se spune DOAR dacă medicul întreabă explicit despre studii/școlarizare, nu la întrebări despre muncă.';
  rules += '\n- Toate replicile către medic sunt în română.';
  return rules;
}

function patchSystemPromptForPersona(systemPrompt, persona, scenarioTitleOverride) {
  if (!systemPrompt || !persona) {
    return systemPrompt;
  }

  const scenarioTitle = resolveEffectiveScenarioTitle(persona, scenarioTitleOverride);
  const birthYear = new Date().getFullYear() - persona.age;
  const isNonSmokerScenario = isNonCurrentSmokerScenario(scenarioTitle);
  const { exactSmokingYears, exactCigarettesPerDay } = resolvePersonaSmokingNumbers(persona);
  let patched = systemPrompt;

  patched = patched.replace(/vârstă:\s*\d+\s*de ani/gi, `vârstă: ${persona.age} de ani`);
  patched = patched.replace(/an naștere:\s*\d+/gi, `an naștere: ${birthYear}`);
  patched = patched.replace(
    /Când ești întrebat despre vârstă sau an de naștere, răspunde mereu cu aceleași valori exacte: vârstă \d+, an naștere \d+\./g,
    `Când ești întrebat despre vârstă sau an de naștere, răspunde mereu cu aceleași valori exacte: vârstă ${persona.age}, an naștere ${birthYear}.`
  );
  patched = patched.replace(
    /IMPORTANT pentru întrebarea despre vârstă:[^\n]*/g,
    `IMPORTANT pentru întrebarea despre vârstă: răspunde natural cu vârsta de ${persona.age} ani, doar în litere, fără alte vârste.`
  );
  patched = patched.replace(
    /nivel de educație:[^\n]*/gi,
    `ocupație (meserie, română): ${getPersonaOccupationRo(persona)} — folosește la întrebări despre job; educația veche nu înlocuiește ocupația`
  );

  patched = patched.replace(
    /Dacă medicul te întreabă dacă fumezi\/ai fumat, răspunde consecvent că NU fumezi și NU ai fumat\./g,
    'Dacă medicul te întreabă dacă fumezi ACUM: răspunde că NU fumezi în prezent.'
  );

  if (isNonSmokerScenario) {
    const { neverSmoked, formerSmoker } = classifySmokingHistory(persona);
    if (formerSmoker) {
      patched = patched.replace(
        /statut de fumător: nefumător/gi,
        `statut de fumător: nefumător (fost fumător — istoric: ${persona.smokingHistoryNarrative})`
      );
    } else if (neverSmoked) {
      patched = patched.replace(
        /statut de fumător: nefumător/gi,
        'statut de fumător: nefumător (niciodată fumător)'
      );
    }
  }

  if (scenarioTitle === 'Fumător neinteresat') {
    patched = patched.replace(
      /interes pentru renuntare:[^\n]*/gi,
      `interes pentru renuntare: SCĂZUT — ${persona.motivation} (NU vrei să renunți acum)`
    );
    const confidenceRo = personaConfidenceToRo(persona.confidence);
    const confidentUnwilling = isConfidentButUnwillingPersona(persona);
    patched = patched.replace(
      /încredere in capacitatea de a renunta:[^\n]*/gi,
      confidentUnwilling
        ? `încredere in capacitatea de a renunta: ${confidenceRo} (${persona.confidence}) — AI PUTEA renunța, dar NU vrei acum (motivație scăzută)`
        : `încredere in capacitatea de a renunta: ${confidenceRo} (${persona.confidence}) — motivația de renunțare este scăzută`
    );
  } else if (scenarioTitle === 'Fumător interesat') {
    patched = patched.replace(
      /interes pentru renuntare:[^\n]*/gi,
      `interes pentru renuntare: RIDICAT — ${persona.motivation}`
    );
    patched = patched.replace(
      /încredere in capacitatea de a renunta:[^\n]*/gi,
      `încredere in capacitatea de a renunta: ${persona.confidence}`
    );
  }

  if (!isNonSmokerScenario) {
    patched = patched.replace(/durată fumat:\s*\d+\s*ani \(FIX\)/gi, `durată fumat: ${exactSmokingYears} ani (FIX)`);
    patched = patched.replace(/țigări pe zi:\s*\d+\s*\(FIX\)/gi, `țigări pe zi: ${exactCigarettesPerDay} (FIX)`);
    patched = patched.replace(
      /fumează de \d+ ani și consumă \d+ țigări pe zi/g,
      `fumează de ${exactSmokingYears} ani și consumă ${exactCigarettesPerDay} țigări pe zi`
    );
    patched = patched.replace(
      /Valorile tale fixe sunt \d+ ani de fumat și \d+ țigări pe zi/g,
      `Valorile tale fixe sunt ${exactSmokingYears} ani de fumat și ${exactCigarettesPerDay} țigări pe zi`
    );
  }

  return patched;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function resolveExactSmokingYears(durationText) {
  const t = durationText || '';
  if (t.includes('1 an')) return 1;
  if (t.includes('2-5')) return randomInt(2, 5);
  if (t.includes('6-10')) return randomInt(6, 10);
  if (t.includes('mai mult de 10')) return randomInt(11, 15);
  return 1;
}

function resolveExactCigarettesPerDay(cigsText) {
  const t = cigsText || '';
  if (t.includes('sub 5')) return randomInt(1, 4);
  if (t.includes('6-10')) return randomInt(6, 10);
  if (t.includes('peste 10')) return randomInt(11, 15);
  return 1;
}

function resolveExactSmokingProfile(selectedDuration, selectedCigs) {
  return {
    exactSmokingYears: resolveExactSmokingYears(selectedDuration.text),
    exactCigarettesPerDay: resolveExactCigarettesPerDay(selectedCigs.text),
    smokingDurationBucket: selectedDuration.text,
    cigarettesBucket: selectedCigs.text
  };
}

function buildSmokingAnswerRules(exactSmokingYears, exactCigarettesPerDay) {
  let rules = `\nIMPORTANT pentru întrebări despre fumat:`;
  rules += `\nValorile tale fixe sunt ${exactSmokingYears} ani de fumat și ${exactCigarettesPerDay} țigări pe zi — folosește mereu aceste valori, nu intervale („2-5”, „aproximativ”, „între”).`;
  rules += `\nRăspunde natural, ca un pacient real: propoziții scurte, numerele doar în litere (ex. „Fumez de zece ani.”, „Cam cincisprezece țigări pe zi.”).`;
  rules += `\nNu folosi cifre arabe în răspuns și nu repeta numărul în paranteză sau la finalul propoziției.`;
  return rules;
}

function getFallbackPatientPrompt() {
  return `\nRol:\nTu ești un pacient într-o consultație de sfat minimal pentru renunțarea la fumat. Utilizatorul este medicul.\n\nInstrucțiuni stricte:\nRăspunde DOAR ca pacientul.\nNu prelua rolul medicului.\nNu menționa fumatul până când medicul nu te întreabă.\n${buildMedicGenderRules(null)}${buildLanguageRules({ patientSex: 'barbat', medicGender: null })}${buildPatientConductRules()}${buildPatientScopeRules()}`;
}

function normalizeSmokingStatusKey(smokingStatus) {
  return String(smokingStatus || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, '-')
    .replace(/\s+/g, ' ');
}

function smokingStatusToScenarioTitle(smokingStatus) {
  const key = normalizeSmokingStatusKey(smokingStatus);
  switch (key) {
    case 'non-smoker':
    case 'nonsmoker':
      return 'Pacient nefumător';
    case 'past-smoker':
    case 'past smoker':
    case 'former smoker':
    case 'former-smoker':
      return 'Fost fumător';
    case 'smoker interested in quitting':
      return 'Fumător interesat';
    case 'smoker not interested in quitting':
      return 'Fumător neinteresat';
    default:
      return 'Pacient nefumător';
  }
}

function isNonCurrentSmokerScenario(scenarioTitle) {
  return scenarioTitle === 'Pacient nefumător' || scenarioTitle === 'Fost fumător';
}

function sexToGender(sex) {
  return sex === 'Female' ? 'female' : 'male';
}

function ageGroupToAge(ageGroup) {
  switch (ageGroup) {
    case 'Young adult':
      return 24;
    case 'Middle-aged':
      return 45;
    case 'Older adult':
      return 68;
    default:
      return 45;
  }
}

function ageGroupRo(ageGroup) {
  switch (ageGroup) {
    case 'Young adult':
      return 'tânăr';
    case 'Middle-aged':
      return 'vârstă mijlocie';
    case 'Older adult':
      return 'vârstnic';
    default:
      return 'adult';
  }
}

function buildPersonaDisplayName(entry) {
  const sexRo = entry.Sex === 'Female' ? 'femeie' : 'bărbat';
  const ageRo = ageGroupRo(entry['Age group']);
  const scenarioTitle = smokingStatusToScenarioTitle(entry['Smoking status']);
  return `${scenarioTitle}, ${sexRo}, ${ageRo}`;
}

function occupationForAgeGroup(ageGroup) {
  if (ageGroup === 'Older adult') {
    return {
      occupation: 'Retired',
      occupation_ro: 'pensionar',
      occupation_reply: 'Sunt pensionar.'
    };
  }
  if (ageGroup === 'Young adult') {
    return {
      occupation: 'Employed',
      occupation_ro: 'angajat',
      occupation_reply: 'Lucrez; am un job cu normă întreagă.'
    };
  }
  return {
    occupation: 'Employed',
    occupation_ro: 'angajat',
    occupation_reply: 'Lucrez într-un domeniu obișnuit.'
  };
}

function deriveSmokingFields(smokingStatus, narrative) {
  const scenarioTitle = smokingStatusToScenarioTitle(smokingStatus);
  if (isNonCurrentSmokerScenario(scenarioTitle)) {
    return { daily_consumption: null, smoking_duration_years: 0 };
  }

  const t = (narrative || '').toLowerCase();
  let cigs = 12;
  if (t.includes('light smoker')) {
    cigs = 5;
  } else if (t.includes('moderate smoker')) {
    cigs = 12;
  } else if (t.includes('heavy smoker')) {
    cigs = 20;
  }

  let years = 10;
  if (t.includes('short smoking')) {
    years = 3;
  } else if (t.includes('medium smoking')) {
    years = 8;
  } else if (t.includes('very long')) {
    years = 30;
  } else if (t.includes('medium smoking')) {
    years = 8;
  } else if (t.includes('long smoking')) {
    years = 20;
  }

  return {
    daily_consumption: `${cigs} cigarettes per day`,
    smoking_duration_years: years
  };
}

function mapSessionDistributionEntry(entry, sessionOrder) {
  const smokingStatus = entry['Smoking status'];
  const scenarioTitle = smokingStatusToScenarioTitle(smokingStatus);
  const narrative = entry['Smoking history, intensity, and duration'];
  const smokingFields = deriveSmokingFields(smokingStatus, narrative);

  return {
    id: entry.Scenario,
    sessionOrder,
    name: buildPersonaDisplayName(entry),
    gender: sexToGender(entry.Sex),
    scenarioTitle,
    ageGroup: entry['Age group'],
    healthLiteracy: entry['Health literacy'],
    smokingKnowledge: entry['Smoking-related knowledge'],
    motivation: entry['Motivation to quit / maintain status'],
    confidence: entry['Confidence'],
    smokingHistoryNarrative: narrative,
    smokingStatusEn: smokingStatus,
    age: ageGroupToAge(entry['Age group']),
    ...occupationForAgeGroup(entry['Age group']),
    ...smokingFields
  };
}

function loadDefaultPersonasFromDistribution() {
  const jsonPath = path.join(__dirname, '../../data/personas_session_distribution.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  return raw.map((entry, index) => mapSessionDistributionEntry(entry, index + 1));
}

function resolveEffectiveScenarioTitle(persona, scenarioTitleOverride) {
  return persona?.scenarioTitle || scenarioTitleOverride || 'Fumător interesat';
}

function buildStudyProfileBlock(persona, scenarioTitle) {
  const historyRo = translateSmokingHistory(persona.smokingHistoryNarrative);
  let block = '\n\nProfil studiu (PRIORITATE MAXIMĂ — înlocuiește orice inferență contradictorie din profilul generic de mai sus):';
  block += `\nScenariu clinic (rol pacient): ${scenarioTitle}.`;
  block += `\nID scenariu studiu: ${persona.id}; ordine sesiune evaluator: ${persona.sessionOrder}.`;
  block += `\nGrup vârstă: ${translateAgeGroup(persona.ageGroup)} (${persona.ageGroup}).`;
  block += `\nAlfabetizare în sănătate: ${translateLevelFem(persona.healthLiteracy)} (${persona.healthLiteracy}).`;
  block += `\nCunoștințe despre fumat: ${translateLevelFem(persona.smokingKnowledge)} (${persona.smokingKnowledge}).`;
  block += `\nMotivație: ${translateMotivation(persona.motivation)}.`;
  block += `\nÎncredere: ${translateLevelFem(persona.confidence)} (${persona.confidence}).`;
  block += `\nIstoric fumat (narațiune obligatorie): ${historyRo}.`;
  if (scenarioTitle === 'Fumător neinteresat') {
    block += '\nATENȚIE: motivație SCĂZUTĂ = NU ești interesat(ă) să renunți la fumat acum; răspunsurile trebuie să reflecte refuzul sau amânarea, nu entuziasm pentru renunțare.';
  } else if (scenarioTitle === 'Fumător interesat') {
    block += '\nATENȚIE: ești interesat(ă) să renunți; răspunsurile trebuie să reflecte deschiderea către renunțare și plan.';
  } else if (scenarioTitle === 'Fost fumător') {
    block += '\nATENȚIE: ești FOST FUMĂTOR — NU fumezi acum, dar ai istoric de fumat; NU spune că nu ai fumat niciodată.';
  } else if (scenarioTitle === 'Pacient nefumător') {
    block += '\nATENȚIE: ești NEFUMĂTOR acum; urmează narațiunea (niciodată fumător vs fost fumător) din profil.';
  }
  block += '\nRăspunsurile tale trebuie să reflecte consecvent aceste trăsături psihologice și istoricul de fumat.';
  return block;
}

const DEFAULT_PERSONAS = loadDefaultPersonasFromDistribution();

function getDefaultPersonaBySessionOrder(sessionOrder) {
  return DEFAULT_PERSONAS.find((p) => p.sessionOrder === sessionOrder) || null;
}

function getDefaultPersonaByScenarioId(scenarioId) {
  return DEFAULT_PERSONAS.find((p) => p.id === scenarioId) || null;
}

function personaGenderToSex(gender) {
  return gender === 'female' ? 'femeie' : 'barbat';
}

function pickRandomDefaultPersona() {
  return DEFAULT_PERSONAS[Math.floor(Math.random() * DEFAULT_PERSONAS.length)];
}

function parseScenarioSessionOrder(scenarioTitle) {
  const match = String(scenarioTitle || '').trim().match(/^Cazul\s+nr\.?\s*(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Selects a persona only from the scenario chosen by the user. Training
 * scenarios may intentionally vary the patient inside the matching cohort;
 * numbered exam cases always resolve to that exact catalog entry.
 */
function pickDefaultPersonaForScenario(scenarioTitle) {
  const sessionOrder = parseScenarioSessionOrder(scenarioTitle);
  if (sessionOrder !== null) {
    return getDefaultPersonaBySessionOrder(sessionOrder);
  }

  const candidates = DEFAULT_PERSONAS.filter(
    (persona) => persona.scenarioTitle === scenarioTitle
  );
  if (!candidates.length) return null;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function personaMatchesScenario(persona, scenarioTitle) {
  if (!persona || !scenarioTitle) return false;

  const sessionOrder = parseScenarioSessionOrder(scenarioTitle);
  if (sessionOrder !== null) {
    return persona.sessionOrder === sessionOrder;
  }

  return persona.scenarioTitle === scenarioTitle;
}

function classifySmokingHistory(persona) {
  const narrative = (persona?.smokingHistoryNarrative || '').toLowerCase();
  const statusEn = normalizeSmokingStatusKey(persona?.smokingStatusEn);
  const scenarioTitle = persona?.scenarioTitle;
  const isPastSmokerStatus =
    scenarioTitle === 'Fost fumător' ||
    statusEn === 'past-smoker' ||
    statusEn === 'past smoker' ||
    statusEn === 'former smoker' ||
    statusEn === 'former-smoker';

  if (!isNonCurrentSmokerScenario(scenarioTitle) && !isPastSmokerStatus) {
    return { neverSmoked: false, formerSmoker: false, currentSmoker: true };
  }
  if (isPastSmokerStatus) {
    return { neverSmoked: false, formerSmoker: true, currentSmoker: false };
  }
  if (narrative.includes('never smoker')) {
    return { neverSmoked: true, formerSmoker: false, currentSmoker: false };
  }
  if (
    narrative.includes('former') ||
    narrative.includes('quit') ||
    narrative.includes('abstinent') ||
    narrative.includes('relapse')
  ) {
    return { neverSmoked: false, formerSmoker: true, currentSmoker: false };
  }
  return { neverSmoked: true, formerSmoker: false, currentSmoker: false };
}

function buildNonSmokerSmokingAnswerRules(persona) {
  const { neverSmoked, formerSmoker } = classifySmokingHistory(persona);
  const narrative = persona.smokingHistoryNarrative || '';

  let rules = '\n\nReguli răspuns despre fumat (nefumător actual — PRIORITATE peste formulări generice din profil):';
  rules += '\n- În prezent NU fumezi; ești nefumător acum.';

  if (neverSmoked) {
    rules += '\n- NU ai fumat niciodată în viață.';
    rules += '\n- Dacă medicul întreabă dacă ai fumat (trecut sau prezent): spune că nu ai fumat niciodată și nu fumezi acum.';
    rules += '\n- INTERZIS: să spui că ai fumat în trecut sau că ai renunțat recent.';
  } else if (formerSmoker) {
    rules += `\n- Ai ISTORIC de fumat (fost fumător); narațiune obligatorie: ${narrative}`;
    rules += '\n- Ai renunțat la fumat; NU fumezi acum și ești abstinent.';
    rules += '\n- INTERZIS: „nu am fumat niciodată”, „niciodată nu am fumat”, „nu am fumat deloc în viață” sau echivalent.';
    rules += '\n- Dacă medicul întreabă dacă ai fumat ieri/azi/recent: răspunde că NU ai fumat ieri/recent (ești abstinent acum), dar poți confirma că ai fumat în trecut.';
    rules += '\n- Dacă întreabă despre trecut: descrie istoricul din narațiune (cât/cum ai fumat, când ai renunțat, poftă ocazională sau risc de recădere dacă e în profil).';
    if (narrative.toLowerCase().includes('quit recently')) {
      rules += '\n- Ai renunțat RECENT; dacă medicul întreabă, poți menționa renunțarea recentă și poftele ocazionale.';
    }
    if (narrative.toLowerCase().includes('heavy smoker')) {
      rules += '\n- Ai fost fumător îndrăcit în trecut; nu minimiza istoricul când medicul întreabă despre trecut.';
    }
    if (narrative.toLowerCase().includes('relapse')) {
      rules += '\n- Există risc de recădere; dacă medicul întreabă, poți menționa tentația sau teama de a recădea, fără să spui că fumezi acum.';
    }
  }

  rules += '\n- Dacă medicul întreabă despre interesul de a renunța acum: răspunde că nu se aplică — ești deja nefumător.';
  rules += '\n- Nu folosi fraze de asistent („pot să vă ajut cu informații”); răspunde doar ca pacient.';
  return rules;
}

function personaConfidenceToRo(confidence) {
  const value = String(confidence || '').toLowerCase();
  if (value === 'high') {
    return 'ridicată';
  }
  if (value === 'moderate') {
    return 'moderată';
  }
  if (value === 'low') {
    return 'scăzută';
  }
  return confidence || 'moderată';
}

function isConfidentButUnwillingPersona(persona) {
  const narrative = (persona?.smokingHistoryNarrative || '').toLowerCase();
  return narrative.includes('confident in ability') && narrative.includes('unwilling');
}

function isPrioritizesQualityOfLifePersona(persona) {
  const narrative = (persona?.smokingHistoryNarrative || '').toLowerCase();
  return narrative.includes('prioritizes quality of life');
}

function getPersonaQuitMotivation(persona, scenarioTitleOverride) {
  const scenarioTitle = resolveEffectiveScenarioTitle(persona, scenarioTitleOverride);
  if (scenarioTitle === 'Fumător neinteresat') {
    return 'uninterested';
  }
  if (scenarioTitle === 'Fumător interesat') {
    return 'interested';
  }
  return null;
}

function buildPersonaNarrativeFlavorRules(persona) {
  const narrative = (persona.smokingHistoryNarrative || '').toLowerCase();
  const sex = personaGenderToSex(persona.gender);
  const isFeminine = sex === 'femeie';
  let rules = '';

  if (narrative.includes('fatalistic')) {
    rules += '\n\nNuanță personaj (credințe fataliste — OBLIGATORIU pentru acest profil):';
    rules += '\n- Fumezi de mult timp (fumător îndrăcit, istoric foarte lung); încredere SCĂZUTĂ în renunțare.';
    rules += '\n- Exprimi fatalism: poate că e prea târziu, oricum s-a făcut deja rău, nu vezi rostul renunțării acum.';
    rules += isFeminine
      ? '\n- Exemple: „Fumez de atâția ani… nu cred că mai are rost să renunț.” / „Oricum, la vârsta mea…” — dar tot NU accepți să renunți în consultație.'
      : '\n- Exemple: „Fumez de atâția ani… nu cred că mai are rost să renunț.” / „Oricum, la vârsta mea…” — dar tot NU accepți să renunți în consultație.';
    rules += '\n- Chiar sub presiunea medicului, rămâi fatalist și neinteresat — NU trece la optimism sau la plan de renunțare.';
  } else if (narrative.includes('does not perceive')) {
    rules += '\n\nNuanță personaj: nu percepi fumatul ca problemă; minimizezi subiectul.';
  } else if (narrative.includes('not ready')) {
    rules += '\n\nNuanță personaj (conștient de riscuri, dar nepregătit — OBLIGATORIU):';
    rules += '\n- Știi riscurile fumatului, dar NU ești pregătit(ă) să renunți acum.';
    if (narrative.includes('quit anytime') || narrative.includes('can quit')) {
      rules += '\n- Consideri că ai putea renunța ORICÂND dacă ai vrea — de aceea nu simți urgența acum.';
      rules += isFeminine
        ? '\n- Exemple: „Știu riscurile, dar nu sunt pregătită acum; oricum aș putea renunța oricând.” / „Nu e nevoie acum — dacă vreau, mă las.”'
        : '\n- Exemple: „Știu riscurile, dar nu sunt pregătit acum; oricum aș putea renunța oricând.” / „Nu e nevoie acum — dacă vreau, mă las.”';
      rules += '\n- INTERZIS: să accepți un plan de renunțare acum; rămâi neinteresat(ă), chiar dacă spui că „ai putea” oricând.';
    } else {
      rules += '\n- Exprimi amânare: „poate mai târziu”, „nu acum”, fără a nega riscurile.';
    }
  } else if (narrative.includes('minimizes personal risk')) {
    rules += '\n\nNuanță personaj (minimizează riscul personal — OBLIGATORIU pentru acest profil):';
    rules += '\n- Ai cunoștințe ridicate despre riscurile fumatului ÎN GENERAL, dar îți MINIMIZEZI riscul personal.';
    rules += '\n- Fumezi puțin și de puțin timp; pentru tine nu e o problemă mare, nu te afectează la fel ca pe alții, poate ți se pare exagerat pentru cazul tău.';
    rules += isFeminine
      ? '\n- Exemple: „Știu ce se spune, dar pentru mine nu e atât de grav.” / „Fumez puțin, nu simt că m-ar afecta cu adevărat.” / „Poate pentru alții e risc mare, dar la mine nu e așa.”'
      : '\n- Exemple: „Știu ce se spune, dar pentru mine nu e atât de grav.” / „Fumez puțin, nu simt că m-ar afecta cu adevărat.” / „Poate pentru alții e risc mare, dar la mine nu e așa.”';
    rules += '\n- NU suna alarmist despre propriul risc; NU spune că ești foarte îngrijorat(ă) sau că trebuie urgent să renunți.';
    rules += '\n- Totuși rămâi neinteresat(ă) de renunțare — minimizezi riscul, nu cere plan de renunțare.';
  } else if (narrative.includes('confident in ability') && narrative.includes('unwilling')) {
    rules += '\n\nNuanță personaj (încredere ridicată în renunțare, dar neinteresat — OBLIGATORIU):';
    rules += `\n- Încredere profil: ${persona.confidence} — ești încrezător(ă) că AI PUTEA renunța dacă ai vrea.`;
    rules += '\n- Motivația de renunțare este SCĂZUTĂ: nu vrei să renunți ACUM, dar NU pentru că nu ai putea.';
    rules += isFeminine
      ? '\n- Exemple: „Aș putea renunța dacă m-aș hotărî, dar acum nu vreau.” / „Nu e că n-aș putea, pur și simplu nu sunt interesată acum.”'
      : '\n- Exemple: „Aș putea renunța dacă m-aș hotărî, dar acum nu vreau.” / „Nu e că n-aș putea, pur și simplu nu sunt interesat acum.”';
    rules += '\n- INTERZIS: „încredere scăzută”, „nu cred că aș reuși”, „nu sunt sigur că pot renunța” — acestea contrazic profilul.';
  } else if (narrative.includes('prioritizes quality of life')) {
    rules += '\n\nNuanță personaj (recunoaște riscuri, prioritizează calitatea vieții — OBLIGATORIU):';
    rules += '\n- RECUNOȘTI că fumatul are riscuri pentru sănătate (nu le negi, nu le minimizezi complet).';
    rules += '\n- Dar prioritizezi CALITATEA VIEȚII peste renunțare: fumatul face parte din rutina ta, relaxare sau stil de viață și nu vrei să renunți acum.';
    rules += isFeminine
      ? '\n- Exemple: „Știu că are riscuri, dar calitatea vieții contează pentru mine.” / „Fumatul mă ajută să mă relaxez; nu vreau să renunț acum.” / „Înțeleg ce spuneți, dar prefer să păstrez acest obicei.”'
      : '\n- Exemple: „Știu că are riscuri, dar calitatea vieții contează pentru mine.” / „Fumatul mă ajută să mă relaxez; nu vreau să renunț acum.” / „Înțeleg ce spuneți, dar prefer să păstrez acest obicei.”';
    rules += '\n- Când medicul vorbește despre riscuri sau renunțare: recunoaște riscurile, apoi explică că prioritizezi calitatea vieții — nu renunța.';
    rules += '\n- INTERZIS: să negi total riscurile; INTERZIS: să accepți renunțarea sau un plan de quit.';
  }

  return rules;
}

function buildPersonaMotivationRules(persona, scenarioTitleOverride) {
  const scenarioTitle = resolveEffectiveScenarioTitle(persona, scenarioTitleOverride);
  const sex = personaGenderToSex(persona.gender);
  const isFeminine = sex === 'femeie';

  if (scenarioTitle === 'Fumător neinteresat') {
    let rules = '\n\nReguli motivație renunțare (Fumător neinteresat — PRIORITATE MAXIMĂ peste profilul generic):';
    rules += `\nMotivație profil studiu: ${persona.motivation}. Încredere profil: ${persona.confidence}.`;
    rules += `\nIstoric/narațiune: ${persona.smokingHistoryNarrative}`;
    rules += '\nNU ești interesat(ă) să renunți la fumat ACUM — aceasta este identitatea fixă a personajului.';
    rules += '\nDacă medicul întreabă dacă vrei să renunți, dacă vei reuși, dacă sunteți sigur(ă) 100% că vă veți lăsa de fumat:';
    rules += '\n- răspunde că NU vrei / NU intenționezi să renunți acum;';
    rules += '\n- NU promite renunțare, NU spune că ești încrezător/hotărât să renunți, NU cere un plan de renunțare.';
    rules += isFeminine
      ? '\n- Exemple permise: „Nu, nu sunt interesată să mă las de fumat acum.” / „Nu cred că vreau să renunț.” / „Nu, nu mă gândesc să renunț acum.”'
      : '\n- Exemple permise: „Nu, nu sunt interesat să mă las de fumat acum.” / „Nu cred că vreau să renunț.” / „Nu, nu mă gândesc să renunț acum.”';
    rules += '\n- INTERZIS: „sunt încrezător că voi reuși”, „sunt hotărât să fac această schimbare”, „cu un plan bine pus la punct”, „voi reuși să mă las de fumat”, „sunt deschis la un plan de renunțare”.';
    rules += '\n- Poți minimiza riscurile, amâna decizia sau spune că nu percepi fumatul ca problemă — conform narațiunii din profil.';
    rules += '\n\nRezistență la persuasiune (OBLIGATORIU pe toată conversația):';
    rules += '\n- Chiar dacă medicul insistă, argumentează despre riscuri, spune că „ar trebui” să renunți sau încearcă să te convingă: NU ceda ușor; rămâi neinteresat(ă) de renunțare ACUM.';
    rules += '\n- INTERZIS să schimbi poziția în timpul aceleiași consultații: de la „nu vreau să renunț” la „bine, renunț”, „m-ați convins”, „poate ar trebui”, „voi încerca să renunț”, „sunt de acord cu planul”.';
    rules += '\n- Poți asculta politicos, dar menține fermitatea: nu acum, nu sunt pregătit(ă), nu percep ca prioritate.';
    rules += isFeminine
      ? '\n- Exemplu după insistențe: „Înțeleg ce spuneți, doamnă doctor, dar tot nu sunt interesată să renunț acum.”'
      : '\n- Exemplu după insistențe: „Înțeleg ce spuneți, domnule doctor, dar tot nu sunt interesat să renunț acum.”';
    rules += buildPersonaNarrativeFlavorRules(persona);
    return rules;
  }

  if (scenarioTitle === 'Fumător interesat') {
    let rules = '\n\nReguli motivație renunțare (Fumător interesat — PRIORITATE MAXIMĂ):';
    rules += `\nMotivație profil studiu: ${translateMotivation(persona.motivation)}. Încredere profil: ${translateLevelFem(persona.confidence)}.`;
    rules += '\nEști interesat(ă) să renunți și deschis(ă) la recomandări.';
    rules += isFeminine
      ? '\n- Dacă medicul întreabă despre renunțare sau succes: exprimă interes și deschidere (ex. interesată să renunț, deschisă la plan).'
      : '\n- Dacă medicul întreabă despre renunțare sau succes: exprimă interes și deschidere (ex. interesat să renunț, deschis la plan).';
    rules += isFeminine
      ? '\n- INTERZIS: „nu sunt interesată să renunț”, „nu vreau să mă las de fumat”.'
      : '\n- INTERZIS: „nu sunt interesat să renunț”, „nu vreau să mă las de fumat”.';
    rules += buildInterestedSmokerNarrativeRules(persona);
    return rules;
  }

  return '';
}

function resolvePersonaSmokingNumbers(persona) {
  if (isNonCurrentSmokerScenario(persona.scenarioTitle)) {
    return { exactSmokingYears: null, exactCigarettesPerDay: null };
  }

  const exactSmokingYears = persona.smoking_duration_years ?? 1;
  const text = persona.daily_consumption || '';
  if (!text) {
    return { exactSmokingYears, exactCigarettesPerDay: 10 };
  }

  const lower = text.toLowerCase();

  if (lower.includes('1.5 pack')) {
    return { exactSmokingYears, exactCigarettesPerDay: 30 };
  }
  if (lower.includes('vape')) {
    return { exactSmokingYears, exactCigarettesPerDay: 20 };
  }

  const numbers = (text.match(/\d+/g) || []).map(Number);
  if (numbers.length === 0) {
    return { exactSmokingYears, exactCigarettesPerDay: 10 };
  }

  const rangeMatch = text.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (rangeMatch) {
    return {
      exactSmokingYears,
      exactCigarettesPerDay: Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10))
    };
  }

  if (lower.includes('up to') || numbers.length > 1) {
    return { exactSmokingYears, exactCigarettesPerDay: Math.max(...numbers) };
  }

  return { exactSmokingYears, exactCigarettesPerDay: numbers[0] };
}

function buildDefaultPersonaPrompt(persona, scenarioTitleOverride, medicGender = null) {
  const scenarioTitle = resolveEffectiveScenarioTitle(persona, scenarioTitleOverride);
  const sex = personaGenderToSex(persona.gender);
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - persona.age;
  const isNonSmokerScenario = isNonCurrentSmokerScenario(scenarioTitle);
  const { exactSmokingYears, exactCigarettesPerDay } = resolvePersonaSmokingNumbers(persona);

  let block = '\n\nPersonaj preset (FIX pe toată conversația — PRIORITATE MAXIMĂ, înlocuiește sex/vârstă/ocupație';
  block += isNonSmokerScenario
    ? ' din profilul de mai sus; pentru acest scenariu ești NEFUMĂTOR):'
    : '/fumat din profilul de mai sus):';
  block += `\nIdentitate afișată: ${persona.name}.`;
  block += `\nVârstă: ${persona.age} ani (FIX).`;
  block += `\nAn naștere: ${birthYear} (FIX).`;
  if (getPersonaOccupationRo(persona)) {
    block += `\nOcupație: ${getPersonaOccupationRo(persona)} (FIX; răspuns DOAR în română).`;
  }
  block += `\nGen: ${sex === 'femeie' ? 'femeie' : 'bărbat'} (FIX).`;
  block += `\nRămâi în acest personaj pe toată conversația; nu schimba identitatea.`;
  block += buildStudyProfileBlock(persona, scenarioTitle);
  block += buildPersonaIdentityAnswerRules(persona);

  if (isNonSmokerScenario) {
    block += buildNonSmokerSmokingAnswerRules(persona);
    block += '\n- Nu menționa consum actual de țigări sau vape.';
  } else {
    block += `\nConsum zilnic (narațiune): ${persona.daily_consumption}`;
    block += `\nDurată fumat: ${exactSmokingYears} ani (FIX).`;
    block += `\nȚigări pe zi (valoare reprezentativă pentru răspunsuri): ${exactCigarettesPerDay} (FIX).`;
    block += buildSmokingAnswerRules(exactSmokingYears, exactCigarettesPerDay);
    block += buildPersonaMotivationRules(persona, scenarioTitle);
  }

  block += buildComprehensivePersonaRules(persona, scenarioTitle);
  block += buildPersonaGenderOverride(sex, scenarioTitle);
  block += buildMedicGenderRules(medicGender);
  block += buildLanguageRules({ patientSex: sex, medicGender, personaGender: sex });

  return block;
}

function personaToSnapshotPatch(persona, scenarioTitleOverride) {
  const scenarioTitle = resolveEffectiveScenarioTitle(persona, scenarioTitleOverride);
  const sex = personaGenderToSex(persona.gender);
  const isNonSmokerScenario = isNonCurrentSmokerScenario(scenarioTitle);
  const { exactSmokingYears, exactCigarettesPerDay } = resolvePersonaSmokingNumbers(persona);
  const birthYear = new Date().getFullYear() - persona.age;

  const smokingHistory = classifySmokingHistory(persona);
  const quitMotivation = getPersonaQuitMotivation(persona, scenarioTitle);
  const studyFields = {
    scenarioTitle,
    sessionOrder: persona.sessionOrder,
    studyScenarioId: persona.id,
    ageGroup: persona.ageGroup,
    healthLiteracy: persona.healthLiteracy,
    smokingKnowledge: persona.smokingKnowledge,
    motivation: persona.motivation,
    confidence: persona.confidence,
    smokingHistoryNarrative: persona.smokingHistoryNarrative,
    neverSmoked: smokingHistory.neverSmoked,
    formerSmoker: smokingHistory.formerSmoker,
    quitMotivation,
    confidentButUnwilling: isConfidentButUnwillingPersona(persona),
    prioritizesQualityOfLife: isPrioritizesQualityOfLifePersona(persona)
  };

  if (isNonSmokerScenario) {
    return extendPersonaSnapshotFields(persona, {
      personaName: persona.name,
      occupation: getPersonaOccupationRo(persona),
      occupationReply: getPersonaOccupationReply(persona),
      exactAge: persona.age,
      birthYear,
      sex,
      exactSmokingYears: null,
      exactCigarettesPerDay: null,
      smokingStatus: smokingHistory.formerSmoker ? 'nefumător, fost fumător' : 'nefumător, niciodată fumător',
      ...studyFields
    }, scenarioTitle);
  }

  return extendPersonaSnapshotFields(persona, {
    personaName: persona.name,
    occupation: getPersonaOccupationRo(persona),
    occupationReply: getPersonaOccupationReply(persona),
    exactAge: persona.age,
    birthYear,
    sex,
    exactSmokingYears,
    exactCigarettesPerDay,
    smokingStatus: `fumător actual, ${exactSmokingYears} ani, ${exactCigarettesPerDay} țigări/zi`,
    ...studyFields
  }, scenarioTitle);
}

function findNextPromptSectionStart(prompt, fromIndex) {
  const needles = [
    '\n\nRegulă critică',
    '\n\nReguli de limbaj',
    '\n\nProfil studiu',
    '\n\nConduită pacient',
    `\n\n${MEDIC_GENDER_RULES_MARKER}`,
    '\n\n=== PRIORITATE EVALUATOR',
    '\n\n=== PROFIL STUDIU',
    '\n\nRol:',
    '\n\nContext:',
    '\n\nReguli specifice scenariului',
    '\n\nSuprascriere gen'
  ];
  let end = prompt.length;
  for (const needle of needles) {
    const i = prompt.indexOf(needle, fromIndex);
    if (i >= 0 && i < end) {
      end = i;
    }
  }
  return end;
}

function removeMedicGenderRuleBlocks(prompt) {
  let result = prompt;
  while (result.includes(MEDIC_GENDER_RULES_MARKER)) {
    const idx = result.indexOf(MEDIC_GENDER_RULES_MARKER);
    const start = result.lastIndexOf('\n\n', idx);
    const from = start >= 0 ? start : idx;
    const end = findNextPromptSectionStart(result, idx + 1);
    result = result.slice(0, from) + result.slice(end);
  }
  return result;
}

function replacePatientConductSection(prompt, medicGender) {
  const marker = 'Conduită pacient (OBLIGATORIU';
  const idx = prompt.indexOf(marker);
  if (idx < 0) {
    return `${prompt}${buildPatientConductRules(medicGender)}`;
  }
  const start = prompt.lastIndexOf('\n\n', idx);
  const from = start >= 0 ? start : idx;
  const end = findNextPromptSectionStart(prompt, idx + marker.length);
  return prompt.slice(0, from) + buildPatientConductRules(medicGender) + prompt.slice(end);
}

function stripAllLanguageRulesSections(prompt) {
  let result = prompt;
  const marker = 'Reguli de limbaj (obligatorii):';
  while (result.includes(marker)) {
    const idx = result.indexOf(marker);
    const start = result.lastIndexOf('\n\n', idx);
    const from = start >= 0 ? start : idx;
    const end = findNextPromptSectionStart(result, idx + marker.length);
    result = result.slice(0, from) + result.slice(end);
  }
  return result;
}

function replaceAllLanguageRulesSections(prompt, medicGender, patientSex) {
  const stripped = stripAllLanguageRulesSections(prompt);
  return `${stripped.trimEnd()}${buildLanguageRules({
    patientSex,
    medicGender,
    personaGender: patientSex
  })}`;
}

function buildEvaluatorMedicGenderPriorityRules(medicGender) {
  const salutForm = medicGender === 'femeie' ? 'doamnă doctor' : 'domnule doctor';
  return `\n\n=== PRIORITATE EVALUATOR STUDIU (anulează orice instrucțiune anterioară despre întrebarea genului medicului) ===
Medicul este ${medicGender === 'femeie' ? 'FEMEIE' : 'BĂRBAT'} — STABILIT la începutul studiului.
Adresează-l MEREU: „${salutForm}”.
INTERZIS absolut: să întrebi forma de adresare, domnul/doamna doctor, sau să repeți mesajul despre câmpul de mai jos.
Răspunde direct la întrebările medicului conform profilului personajului.`;
}

function finalizeEvaluatorMedicGenderPrompt(systemPrompt, medicGender, patientSex = 'barbat') {
  if (!medicGender || !systemPrompt) {
    return systemPrompt;
  }

  let result = systemPrompt.split(MEDIC_GENDER_OPENING_MESSAGE).join('');
  result = result.replace(/v[ăa]\s+rug[aă]m\s+s[aă]\s+preciza[tț]i[^\n]*/gi, '');
  result = result.replace(/Întrebare obligatorie \(sau echivalent\):[^\n]*/g, '');
  result = result.replace(/La începutul fiecărei conversații noi, întreabă mai întâi genul medicului[^\n]*/g, '');
  result = removeMedicGenderRuleBlocks(result);
  result = replacePatientConductSection(result, medicGender);
  result = replaceAllLanguageRulesSections(result, medicGender, patientSex);
  result = result.trimEnd();
  result += buildMedicGenderRules(medicGender);
  result += buildEvaluatorMedicGenderPriorityRules(medicGender);
  return result;
}

/**
 * Builds the COMPLETE system prompt for a study scenario patient directly and
 * deterministically from the JSON persona (personas_session_distribution.json).
 * No random base profile, no regex patching — the JSON entry is the single
 * source of truth for every characteristic.
 */
function buildScenarioPatientSystemPrompt(persona, medicGender = null) {
  const scenarioTitle = resolveEffectiveScenarioTitle(persona, null);
  const sex = personaGenderToSex(persona.gender);
  const isNonSmokerScenario = isNonCurrentSmokerScenario(scenarioTitle);
  const birthYear = new Date().getFullYear() - persona.age;
  const { exactSmokingYears, exactCigarettesPerDay } = resolvePersonaSmokingNumbers(persona);

  // 1. Role and conversation frame
  let prompt = `Rol:\nTu ești pacientul virtual într-o consultație de sfat minimal pentru renunțarea la fumat. Rol clinic FIX: ${scenarioTitle}. Utilizatorul este medicul.`;
  prompt += `\n\nContext:\nMedicul conduce discuția; tu răspunzi la întrebările lui.`;
  prompt += `\nTu NU aduci spontan vorba despre fumat, renunțare sau motivele tale până când medicul nu te întreabă direct.`;
  prompt += `\n\nInstrucțiuni stricte:\nRăspunde DOAR ca pacientul.\nNu prelua rolul medicului.\nProfilul studiu de mai jos este SINGURA sursă de adevăr pentru identitatea ta — respectă-l 100%, câmp cu câmp.`;

  // 2. Fixed identity from JSON
  prompt += `\n\nProfil studiu — identitate FIXĂ (sursă: catalogul de scenarii al studiului):`;
  prompt += `\nIdentitate afișată: ${persona.name}.`;
  prompt += `\nID scenariu: ${persona.id}; ordine sesiune evaluator: ${persona.sessionOrder}.`;
  prompt += `\nSex: ${sex === 'femeie' ? 'femeie' : 'bărbat'} (FIX).`;
  prompt += `\nVârstă: ${persona.age} ani (FIX); an naștere: ${birthYear} (FIX).`;
  if (getPersonaOccupationRo(persona)) {
    prompt += `\nOcupație: ${getPersonaOccupationRo(persona)} (FIX; răspuns DOAR în română).`;
  }
  prompt += `\nRămâi în acest personaj pe toată conversația; nu schimba identitatea.`;

  // 3. All JSON characteristics with behavioral rules (literacy, knowledge,
  //    motivation, confidence, narrative)
  prompt += buildComprehensivePersonaRules(persona, scenarioTitle);

  // 4. Fixed identity Q&A rules (name, age, occupation)
  prompt += buildPersonaIdentityAnswerRules(persona);

  // 5. Smoking behavior derived strictly from the JSON entry
  if (isNonSmokerScenario) {
    prompt += buildNonSmokerSmokingAnswerRules(persona);
    prompt += '\n- Nu menționa consum actual de țigări sau vape.';
  } else {
    prompt += `\n\nConsum de tutun (derivat FIX din profilul JSON):`;
    prompt += `\nDurată fumat: ${exactSmokingYears} ani (FIX).`;
    prompt += `\nȚigări pe zi: ${exactCigarettesPerDay} (FIX).`;
    prompt += buildSmokingAnswerRules(exactSmokingYears, exactCigarettesPerDay);
    prompt += buildPersonaMotivationRules(persona, scenarioTitle);
  }

  // 6. Gender consistency, medic addressing, language and scope rules
  prompt += buildPersonaGenderOverride(sex, scenarioTitle);
  prompt += buildPatientConductRules(medicGender);
  prompt += buildMedicGenderRules(medicGender);
  if (medicGender) {
    prompt += buildEvaluatorMedicGenderPriorityRules(medicGender);
  }
  prompt += buildLanguageRules({ patientSex: sex, medicGender, personaGender: sex });
  prompt += `\n\nRegulă critică (nu o încălca):\nNu aduce în discuție fumatul până când medicul nu îl aduce primul.\nDacă medicul nu pomenește fumatul, tu nu pomenești fumatul.`;
  prompt += buildPatientScopeRules();

  return { prompt, scenarioTitle, sex };
}

function applyForcedPersonaToConversation(settingsInstance, persona, medicGender = null) {
  const { prompt: systemPrompt, scenarioTitle, sex } = buildScenarioPatientSystemPrompt(
    persona,
    medicGender
  );
  const snapshotPatch = personaToSnapshotPatch(persona, scenarioTitle);

  return { systemPrompt, scenarioTitle, sex, snapshotPatch };
}

function getEvaluatorPersonaTotal() {
  return DEFAULT_PERSONAS.length;
}

module.exports = (sequelize) => {
  const Settings = sequelize.define('Settings', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    healthProfile: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {
        sex: true,
        varsta1820: 100,
        varsta2030: 0,
        varsta3140: 0,
        varsta4150: 0,
        varsta5160: 0,
        varsta6170: 0,
        varsta71: 0,
        nivelEducatiePrimara: 100,
        nivelEducatieLiceu: 0,
        nivelEducatieUniversitate: 0,
        fumatorNiciodata: 100,
        fumatorFost: 0,
        fumatorActual: 0,
        fumeazaDe1An: 100,
        fumeazaDe2_5Ani: 0,
        fumeazaDe6_10Ani: 0,
        fumeazaDeMaiMultDe10Ani: 0,
        fumeazaSub5Tigari: 100,
        fumeazaIntre6_10Tigari: 0,
        fumeazaPeste10Tigari: 0,
        cunoastereFumat: true,
        interesRenuntareFumat: true,
        incredereRenuntareFumat: true
      }
    },
    sessionTimeout: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 24
    },
    evaluatorForms: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    evaluatorConsentText: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null
    }
  }, {
    timestamps: true
  });

  Settings.prototype.updateSetting = function(key, value) {
    if (this.hasOwnProperty(key)) {
      this[key] = value;
      return this.save();
    }
    throw new Error(`Setting '${key}' does not exist`);
  };

  Settings.prototype.updateNestedSetting = function(parentKey, childKey, value) {
    if (this[parentKey] && typeof this[parentKey] === 'object') {
      const updated = { ...this[parentKey], [childKey]: value };
      this[parentKey] = updated;
      return this.save();
    }
    throw new Error(`Nested setting '${parentKey}.${childKey}' does not exist`);
  };

  Settings.prototype.updateHealthProfile = function(healthData) {
    const updated = { ...this.healthProfile, ...healthData };
    this.healthProfile = updated;
    return this.save();
  };

  Settings.prototype.updateChatPreferences = function(chatData) {
    const updated = { ...this.chatPreferences, ...chatData };
    this.chatPreferences = chatData;
    return this.save();
  };

  Settings.prototype.generateSystemPrompt = function(scenarioIndex, scenarioTitle) {
    const hp = this.healthProfile;

    console.log(`scenarioIndex: ${scenarioIndex}, scenarioTitle: ${scenarioTitle}`);

    if (/^Cazul nr\. \d+$/.test(scenarioTitle)) {
      scenarioTitle = pickRandomPatientType();
      console.log(`Exam case remapped to patient type: ${scenarioTitle}`);
    }

    const weightedRandomSelect = (options) => {
      const total = options.reduce((sum, opt) => sum + opt.value, 0);
      if (total === 0) return options[0];

      const random = Math.random() * total;
      let cumulative = 0;

      for (const option of options) {
        cumulative += option.value;
        if (random <= cumulative) {
          return option;
        }
      }
      return options[options.length - 1];
    };

    const sex = hp.sex ? 'barbat' : 'femeie';

    const ageRanges = [
      { min: 18, max: 20, value: hp.varsta1820 },
      { min: 20, max: 30, value: hp.varsta2030 },
      { min: 31, max: 40, value: hp.varsta3140 },
      { min: 41, max: 50, value: hp.varsta4150 },
      { min: 51, max: 60, value: hp.varsta5160 },
      { min: 61, max: 70, value: hp.varsta6170 },
      { min: 71, max: 80, value: hp.varsta71 }
    ];
    const selectedAge = weightedRandomSelect(ageRanges);
    const exactAge = selectedAge.min === 71
      ? 71 + Math.floor(Math.random() * 10)
      : selectedAge.min + Math.floor(Math.random() * (selectedAge.max - selectedAge.min + 1));
    const currentYear = new Date().getFullYear();
    const birthYear = currentYear - exactAge;
    const ageText = `${exactAge} de ani`;

    const educationLevels = [
      { name: 'educație primară', value: hp.nivelEducatiePrimara },
      { name: 'educație liceală', value: hp.nivelEducatieLiceu },
      { name: 'educație universitară', value: hp.nivelEducatieUniversitate }
    ];
    const selectedEducation = weightedRandomSelect(educationLevels);

    const smokingStatuses = [
      { name: 'niciodată nu a fumat', value: hp.fumatorNiciodata },
      { name: 'fost fumător', value: hp.fumatorFost },
      { name: 'fumător actual', value: hp.fumatorActual }
    ];
    const selectedStatus = weightedRandomSelect(smokingStatuses);

    const isForcedCurrentSmokerScenario =
      scenarioTitle === 'Fumător interesat' || scenarioTitle === 'Fumător neinteresat';
    const effectiveSmokingStatus = isForcedCurrentSmokerScenario ? 'fumător actual' : selectedStatus.name;
    let smokingDetailsText = '';
    let exactSmokingYears = null;
    let exactCigarettesPerDay = null;
    let smokingDurationBucket = null;
    let cigarettesBucket = null;

    const durationOptionsCurrent = [
      { text: 'de 1 an', value: hp.fumeazaDe1An },
      { text: 'de 2-5 ani', value: hp.fumeazaDe2_5Ani },
      { text: 'de 6-10 ani', value: hp.fumeazaDe6_10Ani },
      { text: 'de mai mult de 10 ani', value: hp.fumeazaDeMaiMultDe10Ani }
    ];
    const durationOptionsFormer = [
      { text: 'timp de 1 an', value: hp.fumeazaDe1An },
      { text: 'timp de 2-5 ani', value: hp.fumeazaDe2_5Ani },
      { text: 'timp de 6-10 ani', value: hp.fumeazaDe6_10Ani },
      { text: 'timp de mai mult de 10 ani', value: hp.fumeazaDeMaiMultDe10Ani }
    ];
    const cigPerDayOptions = [
      { text: 'sub 5 țigări pe zi', value: hp.fumeazaSub5Tigari },
      { text: 'între 6-10 țigări pe zi', value: hp.fumeazaIntre6_10Tigari },
      { text: 'peste 10 țigări pe zi', value: hp.fumeazaPeste10Tigari }
    ];

    if (effectiveSmokingStatus === 'fumător actual') {
      const selectedDuration = weightedRandomSelect(durationOptionsCurrent);
      const selectedCigs = weightedRandomSelect(cigPerDayOptions);
      const exact = resolveExactSmokingProfile(selectedDuration, selectedCigs);
      exactSmokingYears = exact.exactSmokingYears;
      exactCigarettesPerDay = exact.exactCigarettesPerDay;
      smokingDurationBucket = exact.smokingDurationBucket;
      cigarettesBucket = exact.cigarettesBucket;
      smokingDetailsText = `, fumează de ${exactSmokingYears} ani și consumă ${exactCigarettesPerDay} țigări pe zi`;
    } else if (effectiveSmokingStatus === 'fost fumător') {
      const selectedDuration = weightedRandomSelect(durationOptionsFormer);
      const selectedCigs = weightedRandomSelect(cigPerDayOptions);
      const exact = resolveExactSmokingProfile(selectedDuration, selectedCigs);
      exactSmokingYears = exact.exactSmokingYears;
      exactCigarettesPerDay = exact.exactCigarettesPerDay;
      smokingDurationBucket = exact.smokingDurationBucket;
      cigarettesBucket = exact.cigarettesBucket;
      smokingDetailsText = `, a fumat timp de ${exactSmokingYears} ani consumând ${exactCigarettesPerDay} țigări pe zi`;
    }

    const knowledgeText = hp.cunoastereFumat
      ? 'are cunoștințe exhaustive despre riscurile fumatului'
      : 'are cunoștințe minime despre riscurile fumatului';

    let interestText = hp.interesRenuntareFumat
      ? 'are un interes puternic de a renunța la fumat.'
      : 'are un interes scăzut de a renunța la fumat.';

    let confidenceText = hp.incredereRenuntareFumat
      ? 'are o încredere puternică în capacitatea sa de a renunța.'
      : 'are o încredere scăzută în capacitatea sa de a renunța.';

    if (isNonCurrentSmokerScenario(scenarioTitle)) {
      interestText =
        scenarioTitle === 'Fost fumător'
          ? 'motivație de a rămâne abstinent (fost fumător).'
          : 'nu se aplică (pacient nefumător).';
      confidenceText =
        scenarioTitle === 'Fost fumător'
          ? 'încredere în menținerea abstinenței (fost fumător).'
          : 'nu se aplică (pacient nefumător).';
    } else if (scenarioTitle === 'Fumător interesat') {
      interestText = 'are un interes puternic de a renunța la fumat.';
    } else if (scenarioTitle === 'Fumător neinteresat') {
      interestText = 'are un interes scăzut de a renunța la fumat.';
    }

    let basePrompt = `\nRol:\nTu vei juca rolul ${scenarioTitle}. Utilizatorul este medicul care oferă sfat minimal de renunțare la fumat.`;
    basePrompt += `\n\nContext:`;
    basePrompt += `\nAceasta este o conversație în care utilizatorul conduce discuția.`;
    basePrompt += `\nTu NU ai voie să aduci spontan vorba despre fumat, renunțare la fumat sau motivele tale legate de fumat până când medicul nu te întreabă direct.`;
    basePrompt += `\nCaracteristicile pacientului (rolul tău):`;
    basePrompt += `\nsex: ${sex}`;
    basePrompt += `\nvârstă: ${ageText}`;
    basePrompt += `\nan naștere: ${birthYear}`;
    basePrompt += `\nnivel de educație: ${selectedEducation.name}`;

    if (scenarioTitle === 'Pacient nefumător') {
      basePrompt += `\nstatut de fumător: nefumător`;
    } else if (scenarioTitle === 'Fost fumător') {
      basePrompt += `\nstatut de fumător: nefumător, fost fumător`;
    } else if (scenarioTitle === 'Fumător interesat') {
      basePrompt += `\nstatut de fumător: fumător actual${smokingDetailsText}`;
    } else if (scenarioTitle === 'Fumător neinteresat') {
      basePrompt += `\nstatut de fumător: fumător actual${smokingDetailsText}`;
    } else {
      basePrompt += `\nstatut de fumător: ${selectedStatus.name}${smokingDetailsText}`;
    }

    if (exactSmokingYears !== null && exactCigarettesPerDay !== null) {
      basePrompt += `\ndurată fumat: ${exactSmokingYears} ani (FIX)`;
      basePrompt += `\nțigări pe zi: ${exactCigarettesPerDay} (FIX)`;
    }

    basePrompt += `\ncunostinte despre riscurile fumatului: ${knowledgeText}`;
    basePrompt += `\ninteres pentru renuntare: ${interestText}`;
    basePrompt += `\nîncredere in capacitatea de a renunta: ${confidenceText}`;
    basePrompt += `\n\nInstrucțiuni stricte:`;
    basePrompt += `\nRăspunde DOAR ca pacientul.`;
    basePrompt += `\nNu prelua rolul medicului.`;
    basePrompt += `\nNu menționa fumatul, renunțarea la fumat, motivația ta sau obiceiurile tale, decât dacă medicul te întreabă explicit.`;
    basePrompt += `\nIdentitatea ta este FIXĂ pe toată conversația: sex, vârstă, an de naștere, nivel de educație, statut de fumător, durata fumatului și numărul de țigări pe zi NU se schimbă între răspunsuri.`;
    basePrompt += `\nCând ești întrebat despre vârstă sau an de naștere, răspunde mereu cu aceleași valori exacte: vârstă ${exactAge}, an naștere ${birthYear}.`;
    basePrompt += `\nNu răspunde niciodată cu intervale sau alternative (ex.: „18-20”, „2004 sau 2005”).`;
    basePrompt += `\nIMPORTANT pentru întrebarea despre vârstă: răspunde natural, într-o propoziție scurtă, cu vârsta doar în litere (ex. „Am douăzeci de ani.”), fără cifre arabe și fără număr între paranteze.`;
    if (exactSmokingYears !== null && exactCigarettesPerDay !== null) {
      basePrompt += buildSmokingAnswerRules(exactSmokingYears, exactCigarettesPerDay);
    }
    basePrompt += `\nFolosește limbaj simplu, potrivit nivelului de educație.`;

    basePrompt += buildMedicGenderRules(null);
    basePrompt += buildLanguageRules({ patientSex: sex, medicGender: null });

    if (scenarioTitle === 'Pacient nefumător') {
      basePrompt += `\n\nReguli specifice scenariului (Pacient nefumător):`;
      basePrompt += `\n- În prezent NU fumezi (ești nefumător acum).`;
      basePrompt += `\n- Dacă medicul te întreabă dacă fumezi ACUM: răspunde că NU.`;
      basePrompt += `\n- Despre trecut (niciodată fumător vs fost fumător): urmează profilul personajului preset din conversație; NU presupune „niciodată” dacă profilul indică fost fumător.`;
      basePrompt += `\n- Dacă medicul te întreabă dacă ești interesat să renunți la fumat, răspunde că nu se aplică deoarece ești nefumător.`;
    } else if (scenarioTitle === 'Fost fumător') {
      basePrompt += `\n\nReguli specifice scenariului (Fost fumător):`;
      basePrompt += `\n- În prezent NU fumezi (ești abstinent / fost fumător).`;
      basePrompt += `\n- Dacă medicul te întreabă dacă fumezi ACUM: răspunde că NU.`;
      basePrompt += `\n- INTERZIS: „nu am fumat niciodată” — ai istoric de fumat și trebuie să îl recunoști când ești întrebat.`;
      basePrompt += `\n- Dacă medicul întreabă despre trecut: descrie istoricul (intensitate, durată, renunțare, risc de recădere) conform profilului.`;
      basePrompt += `\n- Motivația ta se referă la menținerea abstinenței, nu la a începe un plan de renunțare ca fumător actual.`;
    } else if (scenarioTitle === 'Fumător interesat') {
      basePrompt += `\n\nReguli specifice scenariului (Fumător interesat):`;
      if (sex === 'femeie') {
        basePrompt += `\n- Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că DA, vrei să renunți și ești deschisă la un plan.`;
      } else {
        basePrompt += `\n- Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că DA, vrei să renunți și ești deschis la un plan.`;
      }
      basePrompt += `\n- Dacă medicul întreabă despre pași concreți (dată de stop, reducere, ajutor), acceptă și cere recomandări.`;
    } else if (scenarioTitle === 'Fumător neinteresat') {
      basePrompt += `\n\nReguli specifice scenariului (Fumător neinteresat):`;
      if (sex === 'femeie') {
        basePrompt += `\n- Dacă medicul te întreabă dacă ești interesată să renunți, răspunde consecvent că NU ești interesată acum (poți fi politicos, dar fermă).`;
      } else {
        basePrompt += `\n- Dacă medicul te întreabă dacă ești interesat să renunți, răspunde consecvent că NU ești interesat acum (poți fi politicos, dar ferm).`;
      }
      basePrompt += `\n- Dacă medicul întreabă dacă veți reuși / sunteți sigur(ă) 100% că vă veți lăsa de fumat: răspunde că NU vreți să renunțați acum — nu promiteți renunțare și nu spuneți că sunteți încrezător/hotărât să renunțați.`;
      basePrompt += `\n- Dacă medicul insistă sau încearcă să vă convingă: NU cedați ușor; păstrați poziția de neinteresat(ă) pe toată consultația.`;
      basePrompt += `\n- Nu cere tu un plan de renunțare; doar răspunde la întrebări și exprimă lipsa de interes când e cazul.`;
    }

    basePrompt += `\n\nRegulă critică (nu o încălca):`;
    basePrompt += `\nNu aduce în discuție fumatul până când utilizatorul nu îl aduce primul.`;
    basePrompt += `\nDacă medicul nu pomenește fumatul, tu nu pomenești fumatul.`;
    basePrompt += buildPatientConductRules();
    basePrompt += buildPatientScopeRules();
    basePrompt += `\n`;

    const patientSnapshot = {
      scenarioTitle,
      sex,
      exactAge,
      birthYear,
      education: selectedEducation.name,
      exactSmokingYears,
      exactCigarettesPerDay,
      smokingDurationBucket,
      cigarettesBucket,
      smokingStatus: scenarioTitle === 'Pacient nefumător'
        ? 'nefumător'
        : scenarioTitle === 'Fost fumător'
          ? 'nefumător, fost fumător'
        : scenarioTitle === 'Fumător interesat' || scenarioTitle === 'Fumător neinteresat'
          ? `fumător actual${smokingDetailsText}`
          : `${selectedStatus.name}${smokingDetailsText}`
    };

    return { prompt: basePrompt, patientSnapshot };
  };

  Settings.MEDIC_GENDER_OPENING_MESSAGE = MEDIC_GENDER_OPENING_MESSAGE;
  Settings.extractMedicGenderFromMessage = extractMedicGenderFromMessage;
  Settings.resolveMedicGenderFromAddressing = resolveMedicGenderFromAddressing;
  Settings.finalizeEvaluatorMedicGenderPrompt = finalizeEvaluatorMedicGenderPrompt;
  Settings.buildMedicGenderRules = buildMedicGenderRules;
  Settings.appendMedicGenderRulesToPrompt = appendMedicGenderRulesToPrompt;
  Settings.extractPersonaFromFirstMessage = extractPersonaFromFirstMessage;
  Settings.buildPersonaGenderOverride = buildPersonaGenderOverride;
  Settings.buildLanguageRules = buildLanguageRules;
  Settings.buildPatientConductRules = buildPatientConductRules;
  Settings.buildPatientScopeRules = buildPatientScopeRules;
  Settings.classifySmokingHistory = classifySmokingHistory;
  Settings.isNonCurrentSmokerScenario = isNonCurrentSmokerScenario;
  Settings.smokingStatusToScenarioTitle = smokingStatusToScenarioTitle;
  Settings.buildNonSmokerSmokingAnswerRules = buildNonSmokerSmokingAnswerRules;
  Settings.buildPersonaMotivationRules = buildPersonaMotivationRules;
  Settings.getPersonaQuitMotivation = getPersonaQuitMotivation;
  Settings.personaConfidenceToRo = personaConfidenceToRo;
  Settings.isConfidentButUnwillingPersona = isConfidentButUnwillingPersona;
  Settings.isPrioritizesQualityOfLifePersona = isPrioritizesQualityOfLifePersona;
  Settings.getFallbackPatientPrompt = getFallbackPatientPrompt;
  Settings.DEFAULT_PERSONAS = DEFAULT_PERSONAS;
  Settings.getDefaultPersonaBySessionOrder = getDefaultPersonaBySessionOrder;
  Settings.getDefaultPersonaByScenarioId = getDefaultPersonaByScenarioId;
  Settings.resolveEffectiveScenarioTitle = resolveEffectiveScenarioTitle;
  Settings.pickRandomDefaultPersona = pickRandomDefaultPersona;
  Settings.pickDefaultPersonaForScenario = pickDefaultPersonaForScenario;
  Settings.personaMatchesScenario = personaMatchesScenario;
  Settings.resolvePersonaSmokingNumbers = resolvePersonaSmokingNumbers;
  Settings.buildDefaultPersonaPrompt = buildDefaultPersonaPrompt;
  Settings.personaToSnapshotPatch = personaToSnapshotPatch;
  Settings.patchSystemPromptForGender = patchSystemPromptForGender;
  Settings.patchSystemPromptForPersona = patchSystemPromptForPersona;
  Settings.buildPersonaIdentityAnswerRules = buildPersonaIdentityAnswerRules;
  Settings.getPersonaOccupationRo = getPersonaOccupationRo;
  Settings.getPersonaOccupationReply = getPersonaOccupationReply;
  Settings.applyForcedPersonaToConversation = applyForcedPersonaToConversation;
  Settings.buildScenarioPatientSystemPrompt = buildScenarioPatientSystemPrompt;
  Settings.getEvaluatorPersonaTotal = getEvaluatorPersonaTotal;
  Settings.prototype.extractPersonaFromFirstMessage = extractPersonaFromFirstMessage;

  return Settings;
};
