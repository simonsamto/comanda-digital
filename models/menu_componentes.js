'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MenuComponente extends Model {}

  MenuComponente.init({
    menu_id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Importante: define esto como parte de la llave primaria
      references: {
        model: 'menus',
        key: 'id'
      }
    },
    componente_id: {
      type: DataTypes.INTEGER,
      primaryKey: true, // Importante: define esto como parte de la llave primaria
      references: {
        model: 'componentes',
        key: 'id'
      }
    },
    por_defecto: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'MenuComponente',
    tableName: 'menu_componentes',
    timestamps: true
  });
  
  return MenuComponente;
};