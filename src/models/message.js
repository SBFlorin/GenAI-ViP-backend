const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Conversations',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['user', 'assistant', 'system']]
      }
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        timestamp: null,
        processingTime: null,
        finishReason: null,
        temperature: null
      }
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    parentMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Messages',
        key: 'id'
      }
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['conversationId']
      },
      {
        fields: ['role']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  // Instance methods
  Message.prototype.markAsEdited = function() {
    this.isEdited = true;
    return this.save();
  };

  Message.prototype.estimateTokens = function() {
    // Rough estimation: ~4 characters per token
    const estimatedTokens = Math.ceil(this.content.length / 4);
    this.tokens = estimatedTokens;
    return estimatedTokens;
  };

  return Message;
};