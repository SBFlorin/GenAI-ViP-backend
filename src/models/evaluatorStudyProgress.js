const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EvaluatorStudyProgress = sequelize.define(
    'EvaluatorStudyProgress',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      participantName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      medicGender: {
        type: DataTypes.STRING,
        allowNull: true
      },
      consentAcceptedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      consentTextSnapshot: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      profileCompleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      profileData: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {}
      },
      currentPersonaIndex: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      sessions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: []
      },
      studyCompletedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      overallEvaluationData: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
        get() {
          const raw = this.getDataValue('overallEvaluationData');
          if (raw == null || raw === '') {
            return {};
          }
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              return parsed && typeof parsed === 'object' ? parsed : {};
            } catch {
              return {};
            }
          }
          return raw;
        },
        set(value) {
          this.setDataValue(
            'overallEvaluationData',
            value && typeof value === 'object' ? value : {}
          );
        }
      },
      overallEvaluationSubmittedAt: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ['userId', 'participantName']
        }
      ]
    }
  );

  return EvaluatorStudyProgress;
};
