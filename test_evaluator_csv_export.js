/**
 * Evaluator CSV export tests.
 * Run: node test_evaluator_csv_export.js
 */
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

const User = require('./src/models/user')(sequelize);
const Conversation = require('./src/models/conversation')(sequelize);
const Message = require('./src/models/message')(sequelize);
const EvaluatorStudyProgress = require('./src/models/evaluatorStudyProgress')(sequelize);

Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });
User.hasMany(EvaluatorStudyProgress, { foreignKey: 'userId', as: 'evaluatorAttempts' });
EvaluatorStudyProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const {
  buildRowsForProgress,
  buildColumnSets,
  buildBaseColumns,
  rowsToCsvString,
  formatConversationTranscript,
  summarizeMessages
} = require('./src/utils/evaluatorCsvExport');
const { getEvaluatorFormsConfig } = require('./src/utils/evaluatorFormsConfig');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('OK:', message);
}

async function main() {
  await sequelize.sync({ force: true });

  const user = await User.create({
    email: 'eval@test.com',
    username: 'evaluser',
    password: 'hashed',
    firstName: 'Maria',
    lastName: 'Popescu',
    role: 'evaluator'
  });

  const conversation = await Conversation.create({
    userId: user.id,
    title: 'Test conv',
    model: 'gpt-4o',
    systemPrompt: 'test',
    metadata: {}
  });

  await Message.bulkCreate([
    {
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Bună ziua, doctore.',
      metadata: {}
    },
    {
      conversationId: conversation.id,
      role: 'user',
      content: 'Bună ziua. Fumați?',
      metadata: {}
    },
    {
      conversationId: conversation.id,
      role: 'assistant',
      content: 'Nu, nu fumez.',
      metadata: {}
    }
  ]);

  const progress = await EvaluatorStudyProgress.create({
    userId: user.id,
    participantName: 'Dr. Test',
    medicGender: 'femeie',
    consentAcceptedAt: new Date('2026-07-14T10:00:00Z'),
    consentTextSnapshot: 'consent text',
    profileCompleted: true,
    profileData: {
      professions: ['Family physician'],
      experience: '5–10 years',
      cessationCounselling: 'Yes',
      teaching: 'No',
      affiliations: ['Medical university']
    },
    currentPersonaIndex: 2,
    sessions: [
      {
        sessionOrder: 1,
        scenarioId: 1,
        personaName: 'Pacient nefumător, femeie, tânăr',
        conversationId: conversation.id,
        chatCompletedAt: '2026-07-14T10:30:00Z',
        evaluationSubmittedAt: '2026-07-14T10:45:00Z',
        evaluationData: {
          likert: { 'main-0': 5, 'main-1': 4, 'main-2': 5, 'main-3': 4 },
          improvementSuggestions: 'Mai mult realism.',
          errorReport: {
            issues: ['f. Alt răspuns problematic'],
            issueOther: 'Detaliu extra'
          }
        }
      }
    ],
    studyCompletedAt: null
  });

  progress.user = user;

  const messages = await Message.findAll({ where: { conversationId: conversation.id } });
  const summary = summarizeMessages(messages);
  assert(summary.medic_message_count === 1, 'medic message count');
  assert(summary.patient_message_count === 2, 'patient message count');
  assert(summary.conversation_exchanges === 1, 'conversation exchanges');

  const transcript = formatConversationTranscript(messages);
  assert(transcript.includes('Medic:'), 'transcript includes medic');
  assert(transcript.includes('Pacient virtual:'), 'transcript includes patient');

  const formsConfig = getEvaluatorFormsConfig(null);
  const columnSets = buildColumnSets(formsConfig);
  const messagesMap = new Map([[conversation.id, messages]]);
  const rows = buildRowsForProgress(progress, user, formsConfig, columnSets, messagesMap);
  const csv = rowsToCsvString(rows, buildBaseColumns(columnSets));
  const rowCount = rows.length;

  assert(rowCount >= 2, 'profile + session rows exported');
  assert(csv.includes('Transcript conversație'), 'CSV has transcript header');
  assert(csv.includes('Mesaje medic (user)'), 'CSV has medic count header');
  assert(csv.includes('Consimțământ acceptat la'), 'CSV has consent timestamp');
  assert(csv.includes('Bună ziua. Fumați?'), 'CSV includes conversation text');
  assert(csv.includes('Mai mult realism.'), 'CSV includes evaluation text');
  assert(csv.includes('Doamna doctor'), 'CSV includes medic addressing');

  await progress.update({
    studyCompletedAt: new Date('2026-07-14T12:00:00Z'),
    overallEvaluationData: {
      likert: { 'overall-0': 5, 'overall-1': 4, 'overall-2': 3, 'overall-3': 5, 'overall-4': 4 },
      strengths: 'Interfață clară',
      betaImprovements: 'Mai multe scenarii'
    },
    overallEvaluationSubmittedAt: new Date('2026-07-14T12:15:00Z')
  });
  progress.user = user;

  const rowsWithOverall = buildRowsForProgress(
    progress,
    user,
    formsConfig,
    columnSets,
    messagesMap
  );
  const overallRow = rowsWithOverall.find((r) => r.row_type === 'evaluare_finala');
  assert(overallRow, 'overall evaluation row exported');
  assert(overallRow['overall_likert_overall-0'] === 5, 'overall likert value exported');
  assert(overallRow.overall_strengths === 'Interfață clară', 'overall strengths exported');

  const csvWithOverall = rowsToCsvString(rowsWithOverall, buildBaseColumns(columnSets));
  assert(csvWithOverall.includes('Evaluare finală trimisă la'), 'CSV has overall eval timestamp header');
  assert(csvWithOverall.includes('Interfață clară'), 'CSV includes overall strengths text');

  // Production bug: overallEvaluationData stored as TEXT JSON string (ALTER TABLE migration)
  const progressStringJson = {
    id: 99,
    participantName: 'String JSON',
    medicGender: 'barbat',
    consentAcceptedAt: null,
    profileCompleted: true,
    profileData: {},
    currentPersonaIndex: 16,
    sessions: [],
    studyCompletedAt: new Date('2026-07-20T10:00:00Z'),
    overallEvaluationSubmittedAt: new Date('2026-07-20T10:30:00Z'),
    overallEvaluationData: JSON.stringify({
      likert: { 'overall-0': 2, 'overall-1': 3, 'overall-2': 4, 'overall-3': 5, 'overall-4': 1 },
      strengths: 'Puncte forte din TEXT',
      betaImprovements: 'Imbunatatiri din TEXT'
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
    user
  };

  const rowsFromString = buildRowsForProgress(
    progressStringJson,
    user,
    formsConfig,
    columnSets,
    new Map()
  );
  const overallFromString = rowsFromString.find((r) => r.row_type === 'evaluare_finala');
  assert(overallFromString, 'overall row exported when data is JSON string');
  assert(
    overallFromString.overall_strengths === 'Puncte forte din TEXT',
    'parses overall strengths from JSON string column'
  );
  assert(
    overallFromString['overall_likert_overall-0'] === 2,
    'parses overall likert from JSON string column'
  );
  assert(
    overallFromString.overall_betaImprovements === 'Imbunatatiri din TEXT',
    'parses overall beta improvements from JSON string column'
  );

  console.log('\nAll evaluator CSV export tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
