/**
 * Evaluator study API / persona tests.
 * Run: node test_evaluator_study.js
 */
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

const User = require('./src/models/user')(sequelize);
const Settings = require('./src/models/settings')(sequelize);
const Conversation = require('./src/models/conversation')(sequelize);
const EvaluatorStudyProgress = require('./src/models/evaluatorStudyProgress')(sequelize);

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('OK:', message);
}

async function main() {
  await sequelize.sync({ force: true });

  const settingsRow = await Settings.create({
    healthProfile: Settings.rawAttributes?.healthProfile?.defaultValue || {}
  });

  const persona1 = Settings.getDefaultPersonaBySessionOrder(1);
  assert(persona1 && persona1.sessionOrder === 1, 'session order 1 exists');
  assert(persona1.id === 1, 'session 1 maps to study scenario id 1');

  const { systemPrompt, scenarioTitle, sex } = Settings.applyForcedPersonaToConversation(
    settingsRow,
    persona1
  );
  assert(systemPrompt.includes('Profil studiu'), 'forced prompt includes study profile');
  assert(systemPrompt.includes(String(persona1.id)), 'forced prompt includes scenario id');
  assert(scenarioTitle === 'Pacient nefumător', 'persona 1 is non-smoker scenario');
  assert(sex === 'femeie', 'persona 1 is female');

  const total = Settings.getEvaluatorPersonaTotal();
  assert(total >= 10, `catalog has ${total} personas`);

  const user = await User.create({
    email: 'eval@test.com',
    username: 'evaluser',
    password: 'hashed',
    role: 'evaluator',
    firstName: 'Eval',
    lastName: 'User'
  });

  assert(
    Settings.resolveMedicGenderFromAddressing('Doamna doctor') === 'femeie',
    'resolves Doamna doctor addressing'
  );
  assert(
    Settings.resolveMedicGenderFromAddressing('Domnul doctor') === 'barbat',
    'resolves Domnul doctor addressing'
  );

  const withMedicGender = Settings.applyForcedPersonaToConversation(settingsRow, persona1, 'femeie');
  assert(
    withMedicGender.systemPrompt.includes('doamnă doctor'),
    'forced prompt with preset medic gender uses feminine addressing'
  );
  assert(
    withMedicGender.systemPrompt.includes('PRIORITATE EVALUATOR STUDIU'),
    'forced prompt includes evaluator medic-gender priority block'
  );
  assert(
    !withMedicGender.systemPrompt.includes('întreabă mai întâi genul medicului'),
    'forced prompt does not ask medic gender at conversation start'
  );

  let progress = await EvaluatorStudyProgress.create({
    userId: user.id,
    participantName: 'Maria Test',
    medicGender: 'femeie',
    profileCompleted: true,
    profileData: { professions: ['Psychologist'] },
    currentPersonaIndex: 1,
    sessions: [],
    studyCompletedAt: null
  });

  const duplicate = await EvaluatorStudyProgress.findOne({
    where: { userId: user.id, participantName: 'Ion Pop' }
  });
  assert(!duplicate, 'second participant not created yet');

  const progress2 = await EvaluatorStudyProgress.create({
    userId: user.id,
    participantName: 'Ion Pop',
    profileCompleted: false,
    profileData: {},
    currentPersonaIndex: 1,
    sessions: [],
    studyCompletedAt: null
  });
  assert(progress2.id !== progress.id, 'two attempts per shared account');

  const persona = Settings.getDefaultPersonaBySessionOrder(progress.currentPersonaIndex);
  const forced = Settings.applyForcedPersonaToConversation(settingsRow, persona);
  const conversation = await Conversation.create({
    userId: user.id,
    title: 'Test',
    model: 'gpt-4o',
    systemPrompt: forced.systemPrompt,
    metadata: {
      studyMode: 'evaluator',
      forcedPersonaId: persona.id,
      scenarioTitle: forced.scenarioTitle
    }
  });

  assert(conversation.metadata.forcedPersonaId === 1, 'conversation stores forced persona id');

  const sessions = [
    {
      sessionOrder: 1,
      scenarioId: persona.id,
      conversationId: conversation.id,
      evaluationSubmittedAt: new Date().toISOString(),
      evaluationData: { overallQuality: 4 }
    }
  ];
  await progress.update({ sessions });

  const session = sessions.find((s) => s.sessionOrder === 1);
  assert(session.evaluationSubmittedAt, 'evaluation timestamp set');

  await progress.update({ currentPersonaIndex: 2 });
  assert(progress.currentPersonaIndex === 2, 'advanced to session 2');

  const { getEvaluatorConsentText } = require('./src/utils/evaluatorConsentConfig');
  const consentText = getEvaluatorConsentText(settingsRow);
  assert(consentText.includes('Consimțământ informat'), 'default consent text available');

  const withConsent = await EvaluatorStudyProgress.create({
    userId: user.id,
    participantName: 'Ana Consent',
    medicGender: 'femeie',
    consentAcceptedAt: new Date(),
    consentTextSnapshot: consentText,
    profileCompleted: false,
    profileData: {},
    currentPersonaIndex: 1,
    sessions: [],
    studyCompletedAt: null
  });
  assert(withConsent.consentAcceptedAt, 'consent acceptance stored');
  assert(withConsent.consentTextSnapshot === consentText, 'consent text snapshot stored');

  const { buildAttemptSummary } = require('./src/utils/evaluatorStudyHelpers');
  await progress.update({
    studyCompletedAt: new Date(),
    overallEvaluationData: { likert: { 'overall-0': 5 }, strengths: 'Rapid' },
    overallEvaluationSubmittedAt: new Date()
  });
  const summaryDone = buildAttemptSummary(progress);
  assert(summaryDone.statusLabel === 'Finalizat', 'status Finalizat after overall eval');

  const progressPendingOverall = await EvaluatorStudyProgress.create({
    userId: user.id,
    participantName: 'Pending Overall',
    profileCompleted: true,
    profileData: {},
    currentPersonaIndex: 15,
    sessions: [],
    studyCompletedAt: new Date()
  });
  const summaryPending = buildAttemptSummary(progressPendingOverall);
  assert(
    summaryPending.statusLabel === 'Evaluare finală aplicație',
    'status pending overall evaluation'
  );

  const { buildEvaluatorPersonaView, SMOKING_HISTORY_RO } = require('./src/utils/evaluatorPersonaView');
  const personaView = buildEvaluatorPersonaView(Settings.getDefaultPersonaBySessionOrder(1));
  assert(personaView && personaView.details.length >= 9, 'evaluator persona view has all fields');
  assert(
    personaView.details.some((d) => d.key === 'smokingHistory'),
    'evaluator persona view includes smoking history'
  );
  assert(
    personaView.details.find((d) => d.key === 'smokingStatus')?.value === 'Nefumător',
    'evaluator persona view translates smoking status'
  );
  assert(
    personaView.details.find((d) => d.key === 'motivation')?.value.includes('Motivație ridicată'),
    'evaluator persona view translates motivation to Romanian'
  );
  assert(
    !personaView.details.find((d) => d.key === 'smokingHistory')?.value.includes('Never smoker'),
    'evaluator persona view translates smoking history to Romanian'
  );
  assert(
    Object.keys(SMOKING_HISTORY_RO).length >= 15,
    'all 15 smoking history narratives have Romanian translations'
  );

  for (let order = 1; order <= Settings.getEvaluatorPersonaTotal(); order += 1) {
    const view = buildEvaluatorPersonaView(Settings.getDefaultPersonaBySessionOrder(order));
    for (const field of view.details) {
      assert(field.value && field.value.trim(), `persona ${order} field ${field.key} has Romanian value`);
    }
  }

  console.log('\nAll evaluator study tests passed.');
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
