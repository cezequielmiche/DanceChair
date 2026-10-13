// Metro: acepta los modelos 3D (.glb) como archivos del paquete.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf');

// three >= 0.186 llama a process.emitWarning() en su entrada CommonJS (three.cjs), que no existe en
// React Native y truena con "undefined is not a function" cuando @react-three/fiber hace require('three').
// Se usa siempre la versión ES module: además así queda una sola copia de three en el paquete.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return {
      type: 'sourceFile',
      filePath: path.join(path.dirname(require.resolve('three')), 'three.module.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
