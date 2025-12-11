// models/usuario.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Usuario extends Model {
    static associate(models) {
      Usuario.belongsTo(models.Rol, {
        foreignKey: 'RolId',
        as: 'rol'
      });
    }

    async validarPassword(password) {
      // COMPARACIÓN DE TEXTO PLANO (INSEGURO - SOLO DESARROLLO)
      return this.password === password;
    }
  }

  Usuario.init({
    nombre: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
    RolId: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    sequelize,
    modelName: 'Usuario',
    tableName: 'usuarios',
    // hooks eliminados para evitar el hasheo
  });

  return Usuario;
};