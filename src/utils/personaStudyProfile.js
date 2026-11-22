const LEVEL_RO_FEM = {
  Low: 'Scăzută',
  Moderate: 'Moderată',
  High: 'Ridicată'
};

const AGE_GROUP_RO = {
  'Young adult': 'Tânăr adult',
  'Middle-aged': 'Vârstă mijlocie',
  'Older adult': 'Adult vârstnic'
};

const SMOKING_STATUS_RO = {
  'Non-smoker': 'Nefumător',
  'Former smoker': 'Fost fumător',
  'Past-smoker': 'Fost fumător',
  'Past smoker': 'Fost fumător',
  'Smoker interested in quitting': 'Fumător interesat să renunțe',
  'Smoker not interested in quitting': 'Fumător neinteresat să renunțe'
};

const MOTIVATION_RO = {
  'High motivation to remain non-smoker':
    'Motivație ridicată de a rămâne nefumător',
  'High motivation to remain abstinent':
    'Motivație ridicată de a rămâne abstinent',
  'Moderate motivation to remain abstinent':
    'Motivație moderată de a rămâne abstinent',
  High: 'Ridicată',
  Moderate: 'Moderată',
  Low: 'Scăzută'
};

const SMOKING_HISTORY_RO = {
  'Never smoker; occasional peer exposure':
    'Nu a fumat niciodată; expunere ocazională la fumatul persoanelor din jur',
  'Former light smoker; quit recently; occasional cravings':
    'Fost fumător ușor; a renunțat recent; poftă ocazională de a fuma',
  'Former heavy smoker; long smoking history; quit after health problem; relapse risk present':
    'Fost fumător intens; istoric lung de fumat; a renunțat după o problemă de sănătate; risc de recădere prezent',
  'Moderate smoker; short smoking duration; motivated by physical performance':
    'Fumător moderat; durată scurtă de fumat; motivat de performanța fizică',
  'Heavy smoker; long smoking duration; previous failed quit attempt':
    'Fumător intens; durată lungă de fumat; tentativă anterioară eșuată de renunțare',
  'Heavy smoker; long smoking duration; motivated by children/family':
    'Fumător intens; durată lungă; motivat de copii/familie',
  'Heavy smoker; long smoking duration; concerned about health but afraid of withdrawal':
    'Fumător intens; durată lungă de fumat; preocupat de sănătate, dar teamă de simptomele de sevraj',
  'Heavy smoker; long smoking duration; concerned about health but afraid of withdrawal; motivated by children/family':
    'Fumător intens; durată lungă de fumat; preocupat de sănătate, dar teamă de simptomele de sevraj; motivat de copii/familie',
  'Moderate smoker; long smoking duration; motivated by recent medical advice':
    'Fumător moderat; durată lungă de fumat; motivat de un sfat medical recent',
  'Moderate smoker; medium smoking duration; motivated by children/family':
    'Fumător moderat; durată medie de fumat; motivat de copii/familie',
  'Heavy smoker; long smoking duration; confident but ambivalent about support':
    'Fumător intens; durată lungă de fumat; încrezător, dar ambivalent față de sprijin',
  'Light smoker; short smoking duration; does not perceive smoking as a problem':
    'Fumător ușor; durată scurtă de fumat; nu percepe fumatul ca o problemă',
  'Moderate smoker; long smoking duration; aware of risks but not ready to quit':
    'Fumător moderat; durată lungă de fumat; conștient de riscuri, dar nu este pregătit să renunțe',
  'Moderate smoker; long smoking duration; aware of risks but not ready to quit; believes can quit anytime':
    'Fumător moderat; durată lungă de fumat; conștient de riscuri, dar nu este pregătit să renunțe; considerând că poate renunța oricând',
  'Heavy smoker; very long smoking duration; fatalistic beliefs':
    'Fumător intens; durată foarte lungă de fumat; credințe fataliste',
  'Light smoker; short smoking duration; minimizes personal risk':
    'Fumător ușor; durată scurtă de fumat; minimizează riscul personal',
  'Heavy smoker; long smoking duration; confident in ability to quit but currently unwilling':
    'Fumător intens; durată lungă de fumat; încrezător în capacitatea de a renunța, dar momentan nehotărât',
  'Moderate smoker; long smoking duration; acknowledges risk but prioritizes quality of life':
    'Fumător moderat; durată lungă de fumat; recunoaște riscul, dar prioritizează calitatea vieții'
};

function translateLevelFem(value) {
  return LEVEL_RO_FEM[value] || value || '';
}

function translateMotivation(value) {
  if (!value) return '';
  return MOTIVATION_RO[value] || value;
}

function translateSmokingHistory(value) {
  if (!value) return '';
  return SMOKING_HISTORY_RO[value] || value;
}

function translateAgeGroup(value) {
  return AGE_GROUP_RO[value] || value || '';
}

function translateSmokingStatus(value) {
  return SMOKING_STATUS_RO[value] || value || '';
}

function personaSexRo(persona) {
  return persona?.gender === 'female' ? 'Femeie' : 'Bărbat';
}

function buildHealthLiteracyRules(level) {
  let rules = '\n\nAlfabetizare în sănătate (OBLIGATORIU — stil de comunicare FIX):';
  if (level === 'Low') {
    rules +=
      '\n- Folosește propoziții scurte și cuvinte simple, uzuale.' +
      '\n- Evită termeni medicali complicați; dacă medicul folosește termeni tehnici, poți spune că nu înțelegi pe deplin sau cere o explicație simplă.' +
      '\n- INTERZIS: limbaj academic, liste lungi de afecțiuni sau explicații medicale detaliate ca și cum ai fi specialist.';
  } else if (level === 'High') {
    rules +=
      '\n- Poți folosi termeni medicali corecți când discuți despre sănătate (ex. hipertensiune, BPOC, carcinogene).' +
      '\n- Înțelegi explicațiile medicale complexe și poți reformula pe scurt ce ai înțeles.' +
      '\n- INTERZIS: să te prefaci că nu știi ce înseamnă termeni de bază despre riscurile fumatului.';
  } else {
    rules +=
      '\n- Folosește limbaj cotidian, clar, fără jargon excesiv.' +
      '\n- Înțelegi termeni uzuale de sănătate (ex. inimă, plămâni, cancer, tensiune).' +
      '\n- INTERZIS: explicații la nivel de specialist sau, invers, ignoranță totală față de riscuri elementare.';
  }
  return rules;
}

function buildSmokingKnowledgeRules(level) {
  let rules = '\n\nCunoștințe despre fumat (OBLIGATORIU — nivel FIX de informare):';
  if (level === 'Low') {
    rules +=
      '\n- Ai cunoștințe LIMITATE despre riscurile fumatului.' +
      '\n- Poți ști vag că „nu e bine”, dar fără detalii; poți subestima riscurile sau fi imprecis.' +
      '\n- INTERZIS: enumerări detaliate de boli sau statistici medicale ca un expert informat.';
  } else if (level === 'High') {
    rules +=
      '\n- Ai cunoștințe RIDICATE despre riscurile fumatului (cancer, boli cardiovasculare, BPOC, dependență etc.).' +
      '\n- Poți menționa mai multe consecințe ale fumatului când medicul întreabă.' +
      '\n- INTERZIS: să spui că nu știi deloc ce riscuri are fumatul.';
  } else {
    rules +=
      '\n- Ai cunoștințe MODERATE: știi riscurile principale (cancer, boli de inimă, respirație), fără detalii exhaustive.' +
      '\n- INTERZIS: ignoranță totală sau discurs de specialist cu detalii prea tehnice.';
  }
  return rules;
}

function buildConfidenceRules(persona, scenarioTitle) {
  const level = persona.confidence;
  const levelRo = translateLevelFem(level);
  let rules = `\n\nÎncredere (OBLIGATORIU — nivel FIX: ${levelRo}):`;

  if (scenarioTitle === 'Pacient nefumător' || scenarioTitle === 'Fost fumător') {
    if (level === 'High') {
      rules +=
        '\n- Ești FOARTE încrezător(ă) că poți rămâne nefumător/abstinent.' +
        '\n- Exprimi hotărâre clară de a nu fuma / de a rămâne abstinent.';
    } else if (level === 'Low') {
      rules +=
        '\n- Încrederea ta este SCĂZUTĂ — te îngrijorează recăderea sau pofta.' +
        '\n- Poți exprima teamă, îndoială sau vulnerabilitate față de tentația de a fuma.' +
        '\n- INTERZIS: optimism exagerat sau siguranță totală că nu vei recădea.';
    } else {
      rules +=
        '\n- Încredere MODERATĂ — vrei să rămâi nefumător/abstinent, dar recunoști că poate fi dificil uneori.';
    }
    return rules;
  }

  if (scenarioTitle === 'Fumător interesat') {
    if (level === 'High') {
      rules +=
        '\n- Ești încrezător(ă) că POȚI renunța la fumat (cu sau fără sprijin).' +
        '\n- Poți spune că crezi că vei reuși dacă te hotărăști.' +
        '\n- INTERZIS: „nu cred că aș reuși”, „mi-e imposibil”, teamă dominantă de eșec (exceptând mențiuni scurte despre sevraj dacă narațiunea o cere).';
    } else if (level === 'Low') {
      rules +=
        '\n- Încrederea ta în renunțare este SCĂZUTĂ — te temi de eșec, sevraj sau că nu vei reuși.' +
        '\n- Poți exprima anxietate, îndoială, teamă de simptomele de sevraj.' +
        '\n- INTERZIS: „sunt foarte încrezător că voi reuși fără probleme”, optimism nejustificat.';
    } else {
      rules +=
        '\n- Încredere MODERATĂ — ești interesat(ă) să renunți, dar ai și rezerve/rețineri.' +
        '\n- Poți combina speranța cu îngrijorări realiste.';
    }
    return rules;
  }

  if (scenarioTitle === 'Fumător neinteresat') {
    rules +=
      '\n- Încrederea se referă la capacitatea PERCEPUTĂ de a renunța, NU la dorința de a renunța acum.' +
      '\n- Respectă nivelul din profil; dacă profilul indică încredere ridicată dar neinteres, poți spune că ai putea renunța, dar NU vrei acum.';
  }
  return rules;
}

function buildNonSmokerMotivationRules(persona) {
  const motivationRo = translateMotivation(persona.motivation);
  let rules = `\n\nMotivație menținere statut nefumător (OBLIGATORIU — ${motivationRo}):`;

  if (persona.motivation === 'High motivation to remain non-smoker') {
    rules +=
      '\n- Vrei CLAR să rămâi nefumător; respingi idea de a începe fumatul.' +
      '\n- Poți menționa expunerea ocazională la fumatul altora, dar fără dorință de a fuma.';
  } else if (persona.motivation === 'High motivation to remain abstinent') {
    rules +=
      '\n- Vrei CLAR să rămâi abstinent(ă); recunoști pofta ocazională, dar nu vrei să fumezi.' +
      '\n- Poți menționa renunțarea recentă și efortul de a rămâne nefumător.';
  } else if (persona.motivation === 'Moderate motivation to remain abstinent') {
    rules +=
      '\n- Vrei să rămâi abstinent(ă), dar recunoști risc de recădere sau momente de slăbiciune.' +
      '\n- Nu ești la fel de ferm(ă) ca profilul cu motivație ridicată, dar NU fumezi acum și NU vrei să reîncepi.';
  }
  return rules;
}

function buildInterestedSmokerNarrativeRules(persona) {
  const narrative = (persona.smokingHistoryNarrative || '').toLowerCase();
  let rules = '';

  if (narrative.includes('physical performance')) {
    rules +=
      '\n\nNuanță personaj (motivat de performanța fizică — OBLIGATORIU):' +
      '\n- Principalul motiv pentru renunțare: sport, condiție fizică, respiro, energie.' +
      '\n- Menționează performanța fizică când explici de ce vrei să renunți.';
  } else if (narrative.includes('failed quit attempt')) {
    rules +=
      '\n\nNuanță personaj (tentativă anterioară eșuată — OBLIGATORIU):' +
      '\n- Ai mai încercat să renunți și NU a reușit; recunoști eșecul anterior.' +
      '\n- Poți exprima frustrare sau teamă că se va repeta, conform încrederii din profil.';
  } else if (narrative.includes('afraid of withdrawal')) {
    rules +=
      '\n\nNuanță personaj (teamă de sevraj — OBLIGATORIU):' +
      '\n- Ești preocupat(ă) de sănătate, DAR teama de simptomele de sevraj te reține.' +
      '\n- Menționează frica de sevraj, iritabilitate, poftă intensă sau disconfort când discuți renunțarea.' +
      '\n- INTERZIS: negarea completă a temerilor de sevraj.';
  } else if (narrative.includes('recent medical advice')) {
    rules +=
      '\n\nNuanță personaj (motivat de sfat medical recent — OBLIGATORIU):' +
      '\n- Un medic/ consultație recentă te-a determinat să te gândești serios la renunțare.' +
      '\n- Poți face referire la recomandarea medicală recentă ca motiv principal.';
  } else if (narrative.includes('ambivalent about support')) {
    rules +=
      '\n\nNuanță personaj (ambivalent față de sprijin — OBLIGATORIU):' +
      '\n- Ești încrezător(ă) parțial, dar AMBIVALENT(ă) față de sprijin extern (medicație, consiliere, programe).' +
      '\n- Poți spune că nu ești sigur(ă) dacă ai nevoie de ajutor sau preferi să reușești singur(ă).';
  }

  if (narrative.includes('children/family')) {
    rules +=
      '\n\nNuanță personaj (motivat de copii/familie — OBLIGATORIU):' +
      '\n- Un motiv important pentru renunțare: copiii, familia, exemplul pentru cei dragi sau grija față de ei.' +
      '\n- Menționează familia/copiii când explici de ce vrei să renunți.';
  }

  return rules;
}

function buildComprehensivePersonaRules(persona, scenarioTitle) {
  const historyRo = translateSmokingHistory(persona.smokingHistoryNarrative);
  const motivationRo = translateMotivation(persona.motivation);

  let rules =
    '\n\n=== PROFIL STUDIU — CONFORMITATE 100% OBLIGATORIE (toate câmpurile JSON) ===' +
    `\nScenariu ID: ${persona.id}. Ordine sesiune: ${persona.sessionOrder}.` +
    `\nStatut fumat: ${translateSmokingStatus(persona.smokingStatusEn)}.` +
    `\nGrup vârstă: ${translateAgeGroup(persona.ageGroup)} (${persona.age} ani, FIX).` +
    `\nSex: ${personaSexRo(persona)} (FIX).` +
    `\nAlfabetizare în sănătate: ${translateLevelFem(persona.healthLiteracy)}.` +
    `\nCunoștințe despre fumat: ${translateLevelFem(persona.smokingKnowledge)}.` +
    `\nMotivație: ${motivationRo}.` +
    `\nÎncredere: ${translateLevelFem(persona.confidence)}.` +
    `\nIstoric fumat (narațiune obligatorie): ${historyRo}.` +
    '\nINTERZIS absolut: orice răspuns care contrazice unul dintre câmpurile de mai sus.';

  rules += buildHealthLiteracyRules(persona.healthLiteracy);
  rules += buildSmokingKnowledgeRules(persona.smokingKnowledge);
  rules += buildConfidenceRules(persona, scenarioTitle);

  if (scenarioTitle === 'Pacient nefumător' || scenarioTitle === 'Fost fumător') {
    rules += buildNonSmokerMotivationRules(persona);
  } else if (scenarioTitle === 'Fumător interesat') {
    rules += buildInterestedSmokerNarrativeRules(persona);
  }

  rules +=
    '\n\nRegulă finală: răspunsurile tale trebuie să fie verificabile linie cu linie față de profilul de mai sus.';
  return rules;
}

function buildPersonaTurnReminder(snapshot, persona) {
  if (!snapshot || !persona) return '';

  const scenarioTitle = snapshot.scenarioTitle || persona.scenarioTitle || '';
  const parts = [
    'Reminder profil studiu (conformitate 100% — nu contrazice):',
    `Scenariu ${persona.id}: ${translateSmokingStatus(persona.smokingStatusEn)}.`,
    `Vârstă ${snapshot.exactAge ?? persona.age} ani, ${personaSexRo(persona)}.`,
    `Alfabetizare ${translateLevelFem(persona.healthLiteracy)}, cunoștințe fumat ${translateLevelFem(persona.smokingKnowledge)}.`,
    `Motivație ${translateMotivation(persona.motivation)}, încredere ${translateLevelFem(persona.confidence)}.`,
    `Istoric: ${translateSmokingHistory(persona.smokingHistoryNarrative)}.`
  ];

  if (snapshot.exactSmokingYears != null && snapshot.exactCigarettesPerDay != null) {
    parts.push(
      `Fumat actual: ${snapshot.exactSmokingYears} ani, ${snapshot.exactCigarettesPerDay} țigări/zi (FIX).`
    );
  }

  if (snapshot.neverSmoked) {
    parts.push('Nefumător — niciodată fumător.');
  } else if (snapshot.formerSmoker) {
    parts.push('Nefumător acum — fost fumător (recunoaște istoricul).');
  }

  if (snapshot.quitMotivation === 'uninterested') {
    parts.push('Fumător NEINTERESAT de renunțare acum — NU promite renunțare.');
  } else if (snapshot.quitMotivation === 'interested') {
    parts.push('Fumător INTERESAT de renunțare — exprimă deschidere.');
  }

  if (snapshot.confidenceLevel === 'Low' && scenarioTitle === 'Fumător interesat') {
    parts.push('Încredere SCĂZUTĂ — exprimă teamă/îndoială rezonabilă, nu optimism nejustificat.');
  }

  if (persona.healthLiteracy === 'Low') {
    parts.push('Stil simplu — fără jargon medical.');
  } else if (persona.healthLiteracy === 'High') {
    parts.push('Poți folosi termeni medicali corecți.');
  }

  if (persona.smokingKnowledge === 'Low') {
    parts.push('Cunoștințe limitate despre riscuri — fără detalii de expert.');
  } else if (persona.smokingKnowledge === 'High') {
    parts.push('Cunoștințe ridicate — poți detalia riscurile când e cazul.');
  }

  return parts.join(' ');
}

function extendPersonaSnapshotFields(persona, basePatch, scenarioTitle) {
  return {
    ...basePatch,
    healthLiteracyLevel: persona.healthLiteracy,
    smokingKnowledgeLevel: persona.smokingKnowledge,
    confidenceLevel: persona.confidence,
    motivationText: persona.motivation,
    smokingHistoryRo: translateSmokingHistory(persona.smokingHistoryNarrative),
    studyScenarioId: persona.id,
    sessionOrder: persona.sessionOrder
  };
}

module.exports = {
  LEVEL_RO_FEM,
  AGE_GROUP_RO,
  SMOKING_STATUS_RO,
  MOTIVATION_RO,
  SMOKING_HISTORY_RO,
  translateLevelFem,
  translateMotivation,
  translateSmokingHistory,
  translateAgeGroup,
  translateSmokingStatus,
  personaSexRo,
  buildComprehensivePersonaRules,
  buildPersonaTurnReminder,
  extendPersonaSnapshotFields,
  buildHealthLiteracyRules,
  buildSmokingKnowledgeRules,
  buildConfidenceRules,
  buildInterestedSmokerNarrativeRules
};
