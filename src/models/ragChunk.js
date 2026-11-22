const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RagChunk = sequelize.define('RagChunk', {
    id: {
      // Use dataset-provided stable id (e.g. "smrf-3a-s01-c01")
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    scenarioId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    chunkType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'full_dialog',
    },
    phaseFocus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MIXED',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tagsJson: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    retrievalHintsJson: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'smrf',
    },
    sourceTitle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ro',
    },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['scenarioId'] },
      { fields: ['source'] },
      { fields: ['language'] },
    ],
  });

  return RagChunk;
};

