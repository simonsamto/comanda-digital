// models/grupo.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Grupo extends Model {
    static associate(models) {
      // Un Grupo tiene muchos Componentes
      Grupo.hasMany(models.Componente, {
        foreignKey: 'grupo_id',
        as: 'componentes' // Este alias es importante para el `include`
      });
    }
  }

  Grupo.init({
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true // No queremos grupos con el mismo nombre
    }
  }, {
    sequelize,
    modelName: 'Grupo',
    tableName: 'grupos',
    timestamps: false
  });

  return Grupo;
};