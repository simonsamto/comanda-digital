'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Mesa extends Model {
    static associate(models) {
      Mesa.hasMany(models.Pedido, { foreignKey: 'mesa_id', as: 'pedidos' });
    }
  }

  Mesa.init({
    numero: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    capacidad: { type: DataTypes.INTEGER, allowNull: false },
    estado: { type: DataTypes.STRING, defaultValue: 'libre' },
    // NUEVOS CAMPOS PARA EL MAPA
    pos_x: { type: DataTypes.INTEGER, defaultValue: 0 },
    pos_y: { type: DataTypes.INTEGER, defaultValue: 0 },
    ancho: { type: DataTypes.INTEGER, defaultValue: 120 },
    alto: { type: DataTypes.INTEGER, defaultValue: 120 }
  }, {
    sequelize,
    modelName: 'Mesa',
    tableName: 'mesas'
  });

  return Mesa;
};