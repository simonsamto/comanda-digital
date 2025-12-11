// models/componente.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Componente extends Model {
    static associate(models) {
      // Un Componente PERTENECE A un Grupo
      Componente.belongsTo(models.Grupo, {
        foreignKey: 'grupo_id',
        as: 'grupo'
      });

      // Un Componente puede estar en MUCHOS Menus (a través de la tabla intermedia)
      Componente.belongsToMany(models.Menu, {
        through: 'menu_componentes',
        foreignKey: 'componente_id',
        otherKey: 'menu_id',
        as: 'menus'
      });
    }
  }

  Componente.init({
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    grupo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'grupos', // Se asegura que el grupo exista
        key: 'id'
      }
    },
    precio_adicional: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Componente',
    tableName: 'componentes',
    timestamps: false
  });

  return Componente;
};