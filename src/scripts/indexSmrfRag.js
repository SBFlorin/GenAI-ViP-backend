/**
 * One-time (repeatable) indexer for SMRF RAG dataset.
 *
 * Usage:
 *   node src/scripts/indexSmrfRag.js --dataset "/abs/path/to/json_SMRF-1.json"
 *
 * Requires:
 *   - OPENAI_API_KEY in environment (for embeddings)
 */
const fs = require('fs');
const path = require('path');

const { sequelize, RagChunk, RagEmbedding } = require('../db');
const openaiService = require('../services/openaiService');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    if (a === '--dataset') args.dataset = argv[++i];
    else if (a === '--source') args.source = argv[++i];
    else if (a === '--language') args.language = argv[++i];
    else if (a === '--embedding-model') args.embeddingModel = argv[++i];
    else if (a === '--top-k') args.topK = Number(argv[++i]);
    else if (a === '--no-expand') args.noExpand = true;
  }
  return args;
}

function normalizeWhitespace(s) {
  return String(s || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function buildPhaseExcerptChunk({ source, sourceTitle, language, scenario, phase }) {
  const headerLines = [
    `SCENARIU: ${scenario.title}`,
    `PACIENT: ${scenario.patient_profile?.role || 'pacient'}; smoking_status=${scenario.patient_profile?.smoking_status || 'unknown'}; motivation=${scenario.patient_profile?.motivation || 'unknown'}`,
    `CONTEXT: ${(scenario.patient_profile?.clinical_context || []).join(', ') || 'n/a'}`,
    `FOCUS: ${phase}`,
    '',
  ];

  const turns = (scenario.dialog || []).filter(t => t.phase === phase);
  const body = turns.map(t => `${t.speaker}: ${normalizeWhitespace(t.text)}`).join('\n');

  const text = normalizeWhitespace(headerLines.join('\n') + '\n' + body);
  return {
    chunk_id: `${scenario.scenario_id}-${phase.toLowerCase()}`,
    scenario_id: scenario.scenario_id,
    chunk_type: 'phase_excerpt',
    phase_focus: phase,
    title: `${scenario.title} – ${phase}`,
    text,
    tags: Array.from(new Set([...(scenario.tags || []), `phase_${phase.toLowerCase()}`])),
    retrieval_hints: [
      phase,
      ...(scenario.tags || []).slice(0, 5),
      scenario.title,
    ],
  };
}

function buildFullDialogChunkFromScenario({ scenario }) {
  const headerLines = [
    `SCENARIU: ${scenario.title}`,
    `PACIENT: ${scenario.patient_profile?.role || 'pacient'}; smoking_status=${scenario.patient_profile?.smoking_status || 'unknown'}; motivation=${scenario.patient_profile?.motivation || 'unknown'}`,
    `CONTEXT: ${(scenario.patient_profile?.clinical_context || []).join(', ') || 'n/a'}`,
    `FOCUS: Intervenție minimală (ASK-ADVISE-ACT)`,
    '',
  ];
  const body = (scenario.dialog || []).map(t => `${t.speaker}: ${normalizeWhitespace(t.text)}`).join('\n');
  const text = normalizeWhitespace(headerLines.join('\n') + '\n' + body);
  return {
    chunk_id: `${scenario.scenario_id}-full`,
    scenario_id: scenario.scenario_id,
    chunk_type: 'full_dialog',
    phase_focus: 'MIXED',
    title: `${scenario.title} – dialog complet`,
    text,
    tags: Array.from(new Set([...(scenario.tags || []), 'full_dialog'])),
    retrieval_hints: [
      scenario.title,
      ...(scenario.tags || []).slice(0, 6),
    ],
  };
}

function expandChunksFromScenarios(dataset) {
  const expanded = [];
  for (const scenario of dataset.scenarios || []) {
    expanded.push(buildFullDialogChunkFromScenario({ scenario }));
    for (const phase of ['ASK', 'ADVISE', 'ACT']) {
      const hasAny = (scenario.dialog || []).some(t => t.phase === phase);
      if (hasAny) expanded.push(buildPhaseExcerptChunk({ scenario, phase }));
    }
  }
  return expanded;
}

async function upsertChunkAndEmbedding({ chunk, source, sourceTitle, language, embeddingModel }) {
  const text = normalizeWhitespace(chunk.text);
  if (!text) return null;

  const [row] = await RagChunk.upsert({
    id: chunk.chunk_id,
    scenarioId: chunk.scenario_id || null,
    chunkType: chunk.chunk_type || 'full_dialog',
    phaseFocus: chunk.phase_focus || 'MIXED',
    title: chunk.title || null,
    text,
    tagsJson: chunk.tags || [],
    retrievalHintsJson: chunk.retrieval_hints || [],
    source,
    sourceTitle,
    language,
  });

  // Embedding
  const emb = await openaiService.generateEmbedding(text, embeddingModel);
  const vec = emb.embedding;
  const dims = Array.isArray(vec) ? vec.length : 0;
  if (!dims) throw new Error(`Embedding returned invalid vector for chunk ${chunk.chunk_id}`);

  await RagEmbedding.destroy({ where: { chunkId: chunk.chunk_id, model: emb.model } });
  await RagEmbedding.create({
    chunkId: chunk.chunk_id,
    model: emb.model,
    dims,
    embeddingJson: vec,
  });

  return row;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(
      [
        'SMRF RAG indexer',
        '',
        'Usage:',
        '  node src/scripts/indexSmrfRag.js --dataset \"/abs/path/to/json_SMRF-1.json\"',
        '',
        'Options:',
        '  --dataset <path>           Path to dataset JSON (default: /Users/andreidragomir/Documents/Doctorat/Code/json_SMRF-1.json)',
        '  --source <string>          Source label stored in DB (default: smrf)',
        '  --language <string>        Language code (default: ro)',
        '  --embedding-model <string> Embedding model to request (default: text-embedding-3-small)',
        '  --no-expand                Do not generate additional chunks from scenarios[]',
      ].join('\n')
    );
    return;
  }
  const datasetPath = args.dataset || '/Users/andreidragomir/Documents/Doctorat/Code/json_SMRF-1.json';
  const source = args.source || 'smrf';
  const language = args.language || 'ro';
  const embeddingModel = args.embeddingModel || 'text-embedding-3-small';
  const noExpand = !!args.noExpand;

  const abs = path.isAbsolute(datasetPath) ? datasetPath : path.resolve(process.cwd(), datasetPath);
  const raw = fs.readFileSync(abs, 'utf-8');
  const dataset = JSON.parse(raw);

  const sourceTitle = dataset?.source?.title || 'SMRF';
  const baseChunks = Array.isArray(dataset.chunks) ? dataset.chunks : [];
  const expandedChunks = noExpand ? [] : expandChunksFromScenarios(dataset);

  const chunksById = new Map();
  for (const c of baseChunks) chunksById.set(c.chunk_id, c);
  for (const c of expandedChunks) if (!chunksById.has(c.chunk_id)) chunksById.set(c.chunk_id, c);

  const allChunks = Array.from(chunksById.values());
  console.log(`Indexing ${allChunks.length} chunks (base=${baseChunks.length}, expanded=${expandedChunks.length}, noExpand=${noExpand})`);

  await sequelize.sync();

  let ok = 0;
  for (const c of allChunks) {
    try {
      await upsertChunkAndEmbedding({ chunk: c, source, sourceTitle, language, embeddingModel });
      ok++;
      if (ok % 10 === 0) console.log(`Indexed ${ok}/${allChunks.length}`);
    } catch (e) {
      console.error(`Failed chunk ${c.chunk_id}:`, e?.message || e);
    }
  }

  console.log(`Done. Indexed=${ok}/${allChunks.length}`);
  await sequelize.close();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

