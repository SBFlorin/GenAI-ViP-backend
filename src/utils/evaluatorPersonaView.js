const LEVEL_RO = {
  Low: 'Scăzut',
  Moderate: 'Moderat',
  High: 'Ridicat'
};

const {
  LEVEL_RO_FEM,
  AGE_GROUP_RO,
  SMOKING_STATUS_RO,
  MOTIVATION_RO,
  SMOKING_HISTORY_RO,
  translateLevelFem,
  translateMotivation,
  translateSmokingHistory
} = require('./personaStudyProfile');

function translateLevel(value, feminine = false) {
  if (feminine) {
    return translateLevelFem(value);
  }
  const map = LEVEL_RO;
  return map[value] || value || '';
}

function buildEvaluatorPersonaView(persona) {
  if (!persona) return null;

  const smokingStatusEn = persona.smokingStatusEn || '';
  const sexEn = persona.gender === 'female' ? 'Female' : 'Male';
  const SEX_RO = { Female: 'Femeie', Male: 'Bărbat' };

  return {
    scenarioId: persona.id,
    sessionOrder: persona.sessionOrder,
    name: persona.name,
    scenarioTitle: persona.scenarioTitle,
    intro:
      'Profilul de referință al pacientului virtual pentru această sesiune. Verificați în conversație dacă răspunsurile reflectă aceste caracteristici.',
    details: [
      {
        key: 'scenarioId',
        label: 'Scenariu (ID)',
        value: String(persona.id)
      },
      {
        key: 'smokingStatus',
        label: 'Statut privind fumatul',
        value: SMOKING_STATUS_RO[smokingStatusEn] || persona.scenarioTitle
      },
      {
        key: 'ageGroup',
        label: 'Grup de vârstă',
        value: AGE_GROUP_RO[persona.ageGroup] || persona.ageGroup
      },
      {
        key: 'sex',
        label: 'Sex',
        value: SEX_RO[sexEn] || sexEn
      },
      {
        key: 'healthLiteracy',
        label: 'Alfabetizare în sănătate',
        value: translateLevel(persona.healthLiteracy, true)
      },
      {
        key: 'smokingKnowledge',
        label: 'Cunoștințe despre fumat',
        value: translateLevel(persona.smokingKnowledge, true)
      },
      {
        key: 'motivation',
        label: 'Motivație de renunțare / menținere',
        value: translateMotivation(persona.motivation)
      },
      {
        key: 'confidence',
        label: 'Încredere',
        value: translateLevel(persona.confidence, true)
      },
      {
        key: 'smokingHistory',
        label: 'Istoric fumat, intensitate și durată',
        value: translateSmokingHistory(persona.smokingHistoryNarrative),
        multiline: true
      }
    ]
  };
}

module.exports = {
  buildEvaluatorPersonaView,
  translateMotivation,
  translateSmokingHistory,
  SMOKING_STATUS_RO,
  AGE_GROUP_RO,
  MOTIVATION_RO,
  SMOKING_HISTORY_RO
};
