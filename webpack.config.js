const path = require('path');

module.exports = {
  // Punto de entrada para tu aplicación
  entry: './src/js/render.js',  // Asegúrate de que este sea el camino correcto al archivo principal de tu renderer

  // Configuración de salida
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },

  // Configuración para módulos
  module: {
    rules: [
      // Regla para archivos JavaScript
      {
        test: /\.js$/, // Aplica el loader a archivos .js
        exclude: /node_modules/, // Excluye la carpeta node_modules
        use: {
          loader: 'babel-loader', // Utiliza babel-loader
          options: {
            presets: ['@babel/preset-env'] // Configura Babel para usar preset-env
          }
        }
      },
      // Regla para archivos CSS
      {
        test: /\.css$/, // Aplica el loader a archivos CSS
        use: ['style-loader', 'css-loader'], // Utiliza style-loader y css-loader
      }
    ]
  },

  // Configuración para resolver módulos
  resolve: {
    extensions: ['.js', '.jsx', '.css'],
    fallback: {
      "fs": false,  // No incluir fs
      "path": false,  // No incluir path
      "child_process": false  // No incluir child_process
    }
  },

  // Configuración de modo
  mode: 'development', // Cambia a 'production' cuando estés listo para desplegar

  // Añade esto si no está presente y tienes problemas específicos de Electron
  target: 'electron-renderer',

};