// models/mesa.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Mesa extends Model {
    static associate(models) {
      // Definimos la relación: Una Mesa puede tener muchos Pedidos.
      // Esta es la línea que causaba el error si 'models.Pedido' no existía.
      Mesa.hasMany(models.Pedido, {
        foreignKey: 'mesa_id',
        as: 'pedidos'
      });
    }
  }

  Mesa.init({
    numero: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true
    },
    capacidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING,
      defaultValue: 'libre'
    }
  }, {
    sequelize,
    modelName: 'Mesa',
    tableName: 'mesas' // Asegúrate de que coincida con el nombre de tu tabla
  });

  return Mesa;
};