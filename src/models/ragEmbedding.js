const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RagEmbedding = sequelize.define('RagEmbedding', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chunkId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'RagChunks',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dims: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    embeddingJson: {
      // Array<number>
      type: DataTypes.JSON,
      allowNull: false,
    },
  }, {
    timestamps: true,
    indexes: [
      { fields: ['chunkId'] },
      { fields: ['model'] },
    ],
  });

  return RagEmbedding;
};

