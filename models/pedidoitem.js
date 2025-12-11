// models/pedidoitem.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PedidoItem extends Model {
    static associate(models) {
      // Un PedidoItem PERTENECE A un Pedido
      PedidoItem.belongsTo(models.Pedido, {
        foreignKey: 'pedido_id',
        as: 'pedido'
      });
      
      // Un PedidoItem está compuesto de MUCHOS Componentes (a través de la tabla intermedia)
      PedidoItem.belongsToMany(models.Componente, {
        through: 'pedido_item_componentes', // Nombre exacto de la tabla pivote
        foreignKey: 'pedido_item_id',
        otherKey: 'componente_id',
        as: 'componentes'
      });
    }
  }

  PedidoItem.init({
    pedido_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cliente_numero: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    notas: {
      type: DataTypes.STRING,
      allowNull: true // Las notas pueden ser opcionales
    }
  }, {
    sequelize,
    modelName: 'PedidoItem', // El nombre que `models.index.js` usará
    tableName: 'pedido_items',
    timestamps: false // Esta tabla no necesita createdAt/updatedAt
  });

  return PedidoItem;
};