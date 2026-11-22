const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'New Chat'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'archived', 'deleted']]
      }
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'gpt-5.1'
    },
    systemPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: 'Tu ești un pacient într-o consultație de sfat minimal pentru renunțarea la fumat. Utilizatorul este medicul. Răspunde DOAR ca pacientul.'
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        messageCount: 0,
        tokenUsage: 0,
        lastActivity: null,
        tags: []
      }
    },
    isPrivate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  }, {
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ]
  });

  // Instance methods
  Conversation.prototype.generateTitle = function(firstMessage) {
    if (firstMessage && firstMessage.length > 0) {
      const title = firstMessage.substring(0, 50).trim();
      this.title = title.length < firstMessage.length ? `${title}...` : title;
    }
    return this.save();
  };

  Conversation.prototype.updateActivity = function() {
    const metadata = { ...this.metadata };
    metadata.lastActivity = new Date().toISOString();
    metadata.messageCount = (metadata.messageCount || 0) + 1;
    this.metadata = metadata;
    return this.save();
  };

  Conversation.prototype.archive = function() {
    this.status = 'archived';
    return this.save();
  };

  return Conversation;
};