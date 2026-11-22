const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  // SQLITE_STORAGE lets tests and tools point at another file (or ':memory:') without touching the live DB.
  storage: process.env.SQLITE_STORAGE || path.join(__dirname, '../storage/database.sqlite'),
  logging: false,
});

// Import models
const User = require('./models/user')(sequelize);
const Settings = require('./models/settings')(sequelize);
const Conversation = require('./models/conversation')(sequelize);
const Message = require('./models/message')(sequelize);
const RagChunk = require('./models/ragChunk')(sequelize);
const RagEmbedding = require('./models/ragEmbedding')(sequelize);
const EvaluatorStudyProgress = require('./models/evaluatorStudyProgress')(sequelize);

// Define associations
User.hasOne(Settings, { foreignKey: 'userId', as: 'settings', onDelete: 'CASCADE' });
Settings.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Conversation, { foreignKey: 'userId', as: 'conversations', onDelete: 'CASCADE' });
Conversation.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(EvaluatorStudyProgress, {
  foreignKey: 'userId',
  as: 'evaluatorAttempts',
  onDelete: 'CASCADE'
});
EvaluatorStudyProgress.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Conversation.hasMany(Message, { foreignKey: 'conversationId', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Conversation, { foreignKey: 'conversationId', as: 'conversation' });

// Self-referencing association for message threads
Message.belongsTo(Message, { foreignKey: 'parentMessageId', as: 'parent' });
Message.hasMany(Message, { foreignKey: 'parentMessageId', as: 'replies' });

// RAG associations
RagChunk.hasMany(RagEmbedding, { foreignKey: 'chunkId', as: 'embeddings', onDelete: 'CASCADE' });
RagEmbedding.belongsTo(RagChunk, { foreignKey: 'chunkId', as: 'chunk' });

module.exports = {
  sequelize,
  User,
  Settings,
  Conversation,
  Message,
  RagChunk,
  RagEmbedding,
  EvaluatorStudyProgress,
};
