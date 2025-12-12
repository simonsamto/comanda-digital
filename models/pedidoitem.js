'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PedidoItem extends Model {
    static associate(models) {
      PedidoItem.belongsTo(models.Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
      PedidoItem.belongsToMany(models.Componente, {
        through: 'pedido_item_componentes',
        foreignKey: 'pedido_item_id',
        otherKey: 'componente_id',
        as: 'componentes'
      });
    }
  }

  PedidoItem.init({
    pedido_id: { type: DataTypes.INTEGER, allowNull: false },
    cliente_numero: { type: DataTypes.INTEGER, allowNull: false },
    notas: { type: DataTypes.STRING, allowNull: true },
    // NUEVO CAMPO:
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 }
  }, {
    sequelize,
    modelName: 'PedidoItem',
    tableName: 'pedido_items',
    timestamps: false
  });

  return PedidoItem;
};