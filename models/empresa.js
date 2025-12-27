'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Empresa extends Model {
    static associate(models) {
      Empresa.hasMany(models.Pedido, { foreignKey: 'empresa_id', as: 'pedidos' });
    }
  }
  Empresa.init({
    nombre: { type: DataTypes.STRING, allowNull: false },
    nit: { type: DataTypes.STRING, allowNull: true },
    telefono: { type: DataTypes.STRING, allowNull: true },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    sequelize,
    modelName: 'Empresa',
    tableName: 'empresas',
    timestamps: false
  });
  return Empresa;
};