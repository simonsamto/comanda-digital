'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Pedido extends Model {
    static associate(models) {
      // Relación con Mesa
      Pedido.belongsTo(models.Mesa, { foreignKey: 'mesa_id', as: 'mesa' });
      // Relación con Items
      Pedido.hasMany(models.PedidoItem, { foreignKey: 'pedido_id', as: 'items' });
      // NUEVA RELACIÓN: Pedido puede pertenecer a una Empresa (si es crédito)
      Pedido.belongsTo(models.Empresa, { foreignKey: 'empresa_id', as: 'empresa' });
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
    },
    // --- NUEVOS CAMPOS PARA CRÉDITO ---
    empresa_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    medio_pago: {
      type: DataTypes.STRING, // 'efectivo', 'credito_empresa', etc.
      defaultValue: 'efectivo'
    }
  }, {
    sequelize,
    modelName: 'Pedido',
    tableName: 'pedidos'
  });

  return Pedido;
};