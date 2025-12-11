// models/pedido.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pedido extends Model {
    static associate(models) {
      // Definimos la relación inversa: Un Pedido pertenece a una Mesa.
      Pedido.belongsTo(models.Mesa, {
        foreignKey: 'mesa_id',
        as: 'mesa'
      });

      // Y un Pedido tiene muchos Items (uno por cada cliente del pedido).
      Pedido.hasMany(models.PedidoItem, {
        foreignKey: 'pedido_id',
        as: 'items'
      });
    }
  }

  Pedido.init({
    mesa_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estado: {
      type: DataTypes.ENUM('recibido', 'en_preparacion', 'elaborado', 'entregado', 'pagado'),
      defaultValue: 'recibido'
    }
  }, {
    sequelize,
    modelName: 'Pedido', // El nombre que `models.index.js` usará
    tableName: 'pedidos'
  });

  return Pedido;
};