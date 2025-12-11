// models/menu.js

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Menu extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un Menu se compone de muchos Componentes a través de la tabla intermedia 'menu_componentes'
      Menu.belongsToMany(models.Componente, {
        through: 'menu_componentes', // Nombre exacto de la tabla pivote en la BD
        foreignKey: 'menu_id',
        otherKey: 'componente_id',
        as: 'componentes' // Este alias es crucial, es el que usa menuActivo.getComponentes()
      });
    }
  }

  Menu.init({
    // Definición de las columnas de la tabla 'menus'
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    precio_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Menu',      // El nombre del modelo debe ser 'Menu' (en singular y con mayúscula)
    tableName: 'menus',     // El nombre exacto de la tabla en tu base de datos
    timestamps: false       // Si no tienes columnas createdAt/updatedAt, ponlo en false
  });

  return Menu;
};