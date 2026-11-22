/**
 * Evaluate retrieval quality using dataset gold_queries.
 *
 * Usage:
 *   node src/scripts/evalSmrfRetrieval.js --dataset "/abs/path/to/json_SMRF-1.json"
 *
 * Notes:
 *   - Assumes you've already run indexSmrfRag so RagChunks/RagEmbeddings exist.
 *   - Uses the same embedding model as runtime retrieval (defaults to text-embedding-3-small).
 */
const fs = require('fs');
const path = require('path');

const { sequelize } = require('../db');
const ragService = require('../services/ragService');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    if (a === '--dataset') args.dataset = argv[++i];
    else if (a === '--topK') args.topK = Number(argv[++i]);
    else if (a === '--embedding-model') args.embeddingModel = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      [
        'SMRF retrieval evaluator',
        '',
        'Usage:',
        '  node src/scripts/evalSmrfRetrieval.js --dataset \"/abs/path/to/json_SMRF-1.json\"',
        '',
        'Options:',
        '  --dataset <path>           Path to dataset JSON (default: /Users/andreidragomir/Documents/Doctorat/Code/json_SMRF-1.json)',
        '  --topK <n>                 Number of results to inspect (default: 5)',
        '  --embedding-model <string> Embedding model used at query time (default: text-embedding-3-small)',
      ].join('\n')
    );
    return;
  }
  const datasetPath = args.dataset || '/Users/andreidragomir/Documents/Doctorat/Code/json_SMRF-1.json';
  const topK = Number.isFinite(args.topK) ? args.topK : 5;
  const embeddingModel = args.embeddingModel || 'text-embedding-3-small';

  const abs = path.isAbsolute(datasetPath) ? datasetPath : path.resolve(process.cwd(), datasetPath);
  const dataset = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  const queries = dataset.gold_queries || [];

  if (!queries.length) {
    console.log('No gold_queries found in dataset.');
    return;
  }

  let pass = 0;
  for (const q of queries) {
    const results = await ragService.retrieveTopK({
      queryText: q.query_text,
      topK,
      embeddingModel,
    });

    const gotScenarioIds = new Set(results.map(r => r.scenarioId).filter(Boolean));
    const expected = new Set(q.expected_scenario_ids_any || []);
    const hit = Array.from(expected).some(x => gotScenarioIds.has(x));

    console.log(`\n[${q.query_id}] ${q.query_text}`);
    console.log(`Expected any scenario: ${Array.from(expected).join(', ') || '(none)'}`);
    console.log(`Top ${topK} results:`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. chunk=${r.chunkId} scenario=${r.scenarioId} score=${r.score.toFixed(4)} title=${r.title || ''}`);
    });
    console.log(`HIT: ${hit ? 'YES' : 'NO'}`);
    if (hit) pass++;
  }

  console.log(`\nSummary: ${pass}/${queries.length} queries hit expected scenario in top-${topK}.`);
  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

