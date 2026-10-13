// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'arte/*'],
  },
  {
    // Escenas 3D (react-three-fiber) y la pantalla del juego: se animan cada cuadro con refs y objetos
    // de three.js, por eso usan 'use no memo' (fuera del React Compiler) y estas reglas no aplican.
    files: ['src/avatar/**/*.tsx', 'src/game/**/*.tsx', 'src/app/juego.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
    },
  },
  {
    // los modelos 3D, la música y los sonidos se cargan con require() (así los empaqueta Metro)
    files: ['src/avatar/modelos.ts', 'src/audio/sonidos.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
