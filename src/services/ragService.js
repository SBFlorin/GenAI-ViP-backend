const openaiService = require('./openaiService');
const { RagChunk, RagEmbedding } = require('../db');

function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function norm(a) {
  return Math.sqrt(dot(a, a));
}

function cosineSimilarity(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}

let cache = {
  loadedAt: 0,
  ttlMs: 60_000,
  items: [],
  model: null,
};

async function loadIndex({ embeddingModel }) {
  const now = Date.now();
  if (cache.items.length && cache.model === embeddingModel && (now - cache.loadedAt) < cache.ttlMs) {
    return cache;
  }

  const embeddings = await RagEmbedding.findAll({
    where: { model: embeddingModel },
    include: [{ model: RagChunk, as: 'chunk' }],
  });

  const items = embeddings
    .filter(e => e.chunk && Array.isArray(e.embeddingJson))
    .map(e => ({
      embedding: e.embeddingJson,
      chunk: e.chunk,
    }));

  cache = {
    ...cache,
    loadedAt: now,
    items,
    model: embeddingModel,
  };

  return cache;
}

function filterPatientLines(text) {
  const lines = String(text || '').split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^medic\s*:/i.test(trimmed)) return false;
    return true;
  });

  const patientOnly = filtered
    .map((line) => {
      const trimmed = line.trim();
      if (/^patient\s*:/i.test(trimmed)) {
        return trimmed.replace(/^patient\s*:\s*/i, '').trim();
      }
      return trimmed;
    })
    .filter((line) => line.length > 0);

  return patientOnly.join('\n').trim();
}

function buildReferenceBlock(chunks, effectiveGender = null) {
  let header =
    `EXEMPLE DE REPLICI PACIENT.\n` +
    `Imită doar replicile pacientului (ton, structură, succint); nu copia fraze de medic sau de asistent.\n` +
    `Nu menționa explicit aceste exemple.\n`;

  if (effectiveGender === 'barbat') {
    header +=
      `Păstrează genul masculin în replicile tale; nu copia din exemple forme feminine despre tine (ex. interesată, deschisă).\n`;
  } else if (effectiveGender === 'femeie') {
    header +=
      `Păstrează genul feminin în replicile tale; nu copia din exemple forme masculine despre tine (ex. interesat, deschis).\n`;
  }

  const body = chunks
    .map((c, i) => {
      const title = c.title ? `TITLU: ${c.title}\n` : '';
      const patientText = filterPatientLines(c.text);
      if (!patientText) return '';
      return `--- EXAMPLE_${i + 1} ---\n${title}${patientText}`.trim();
    })
    .filter(Boolean)
    .join('\n\n');

  if (!body) return '';

  return (header + '\n' + body).trim();
}

async function retrieveTopK({ queryText, topK = 4, embeddingModel = 'text-embedding-3-small' }) {
  const q = (queryText || '').trim();
  if (!q) return [];

  const qEmb = await openaiService.generateEmbedding(q, embeddingModel);
  const modelUsed = qEmb.model;
  const queryVec = qEmb.embedding;
  if (!Array.isArray(queryVec) || queryVec.length === 0) return [];

  const idx = await loadIndex({ embeddingModel: modelUsed });
  if (!idx.items.length) return [];

  const scored = idx.items.map(({ chunk, embedding }) => ({
    chunk,
    score: cosineSimilarity(queryVec, embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, topK)).map(s => ({
    chunkId: s.chunk.id,
    scenarioId: s.chunk.scenarioId,
    title: s.chunk.title,
    text: s.chunk.text,
    tags: s.chunk.tagsJson,
    score: s.score,
  }));
}

module.exports = {
  retrieveTopK,
  buildReferenceBlock,
  filterPatientLines,
};
