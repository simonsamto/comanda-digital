// models/rol.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Rol extends Model {
    static associate(models) {
      Rol.hasMany(models.Usuario, {
        foreignKey: 'RolId',
        as: 'usuarios'
      });
    }
  }

  Rol.init({
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    sequelize,
    modelName: 'Rol',
    // --- ¡ESTA ES LA LÍNEA MÁS IMPORTANTE! ---
    // Le dice a Sequelize el nombre exacto de la tabla en la base de datos.
    tableName: 'roles',
    // Desactivamos timestamps si no los definimos en el script SQL para esta tabla.
    // El script que te di antes sí los añade, así que los dejamos activos.
    // Si tu tabla no tiene createdAt/updatedAt, pon timestamps: false
  });

  return Rol;
};