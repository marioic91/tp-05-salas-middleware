const fs = require('node:fs');

async function leerArchivoJSON(ruta) {
  try {
    const datosTexto = await fs.promises.readFile(ruta, 'utf-8');
    return JSON.parse(datosTexto);
  } catch (error) {
    console.error('Error al leer el archivo JSON:', error);
    throw error;
  }
}

module.exports = {
  leerArchivoJSON,
};