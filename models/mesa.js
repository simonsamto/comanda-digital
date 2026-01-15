'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Mesa extends Model {
    static associate(models) {
      // define associations here
      Mesa.hasMany(models.Pedido, { foreignKey: 'mesa_id', as: 'pedidos' });
    }
  }
  Mesa.init({
    numero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true // <--- ESTO ES LO QUE CREA EL ÍNDICE
    },
    capacidad: {
      type: DataTypes.INTEGER,
      defaultValue: 4
    },
    estado: {
      type: DataTypes.ENUM('libre', 'ocupado', 'por_cobrar'),
      defaultValue: 'libre'
    },
    // Coordenadas para el mapa visual
    pos_x: { type: DataTypes.INTEGER, defaultValue: 0 },
    pos_y: { type: DataTypes.INTEGER, defaultValue: 0 },
    ancho: { type: DataTypes.INTEGER, defaultValue: 120 },
    alto:  { type: DataTypes.INTEGER, defaultValue: 120 }
  }, {
    sequelize,
    modelName: 'Mesa',
    tableName: 'mesas',
  });
  return Mesa;
};