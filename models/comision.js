'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Comision extends Model {
    static associate(models) {
      Comision.belongsTo(models.Pedido, { foreignKey: 'pedido_id', as: 'pedido' });
    }
  }
  Comision.init({
    pedido_id: DataTypes.INTEGER,
    valor_venta: DataTypes.DECIMAL(10, 2),
    valor_comision: DataTypes.DECIMAL(10, 2),
    estado: { type: DataTypes.ENUM('pendiente', 'facturado', 'pagado'), defaultValue: 'pendiente' }
  }, {
    sequelize,
    modelName: 'Comision',
    tableName: 'comisiones_sistema'
  });
  return Comision;
};