import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import path from 'path';
import fs from 'fs';

const inputFiles = fs
  .readdirSync('./lib/processors')
  .filter((file) => file.endsWith('.ts'))
  .reduce((entries, file) => {
    const name = path.basename(file, '.ts');
    const snakeCaseName = `${name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()}`;
    entries[snakeCaseName] = path.resolve('./lib/processors', file);
    return entries;
  }, {});

const configs = Object.keys(inputFiles).map((name) => ({
  input: inputFiles[name],
  output: {
    file: `dist/${name}.js`,
    format: 'umd',
    name: name,
  },
  plugins: [
    babel({
      babelHelpers: 'bundled',
      include: ['node_modules/@mediapipe/tasks-vision/**'],
    }),
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      emitDeclarationOnly: false,
      sourceMap: false,
    }),
    terser(),
  ],
}));

export default configs;
