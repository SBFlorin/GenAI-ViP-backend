const assert = require('assert');
const { Sequelize } = require('sequelize');
const defineSettings = require('./src/models/settings');
const { buildCompactPersonaProfile } = require('./src/services/livePersonaService');

const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
const Settings = defineSettings(sequelize);

for (let index = 0; index < 100; index += 1) {
  const interested = Settings.pickDefaultPersonaForScenario('Fumător interesat');
  assert(interested, 'An interested-smoker persona should be available');
  assert.strictEqual(interested.scenarioTitle, 'Fumător interesat');
  assert([3, 4, 5, 6].includes(interested.id));

  const uninterested = Settings.pickDefaultPersonaForScenario('Fumător neinteresat');
  assert(uninterested, 'An uninterested-smoker persona should be available');
  assert.strictEqual(uninterested.scenarioTitle, 'Fumător neinteresat');
  assert([7, 8, 9, 10].includes(uninterested.id));
}

const exactCase = Settings.pickDefaultPersonaForScenario('Cazul nr. 8');
assert.strictEqual(exactCase.id, 8);
assert.strictEqual(exactCase.sessionOrder, 8);
assert(Settings.personaMatchesScenario(exactCase, 'Cazul nr 8'));
assert(!Settings.personaMatchesScenario(exactCase, 'Fumător interesat'));

const interestedPersona = Settings.getDefaultPersonaByScenarioId(3);
const applied = Settings.applyForcedPersonaToConversation(null, interestedPersona, null);
assert.strictEqual(applied.scenarioTitle, 'Fumător interesat');
assert.strictEqual(applied.snapshotPatch.quitMotivation, 'interested');
assert(applied.systemPrompt.includes('Ești interesat(ă) să renunți'));
assert(applied.systemPrompt.includes('INTERZIS: „nu sunt interesat'));

const hardenedVoiceProfile = buildCompactPersonaProfile({
  selectedDefaultPersonaId: interestedPersona.id,
  scenarioTitle: 'Fumător interesat',
  patientSnapshot: {
    ...applied.snapshotPatch,
    // Simulates stale metadata from a conversation created before the fix.
    quitMotivation: 'uninterested',
    scenarioTitle: 'Fumător interesat'
  }
});
assert(hardenedVoiceProfile.includes('DECIZIE FIXĂ: vrei să renunți la fumat'));
assert(hardenedVoiceProfile.includes('INTERZIS să spui că nu ești interesat(ă)'));
assert(!hardenedVoiceProfile.includes('DECIZIE FIXĂ: nu vrei să renunți acum'));

console.log('Voice persona locking checks passed.');

sequelize.close();
