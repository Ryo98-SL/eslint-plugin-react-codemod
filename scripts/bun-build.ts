import {ROOT_DIR} from '../paths/index';
import path from "path";
import dts from "bun-plugin-dts";

console.time('build time')
Bun.build({
  entrypoints: [path.join(ROOT_DIR, './src/index.ts')],
  outdir: path.join(ROOT_DIR, './dist'),
  drop: ['console'],
  format: 'esm',
  target: 'node',
  external: [
      'eslint',
     '@typescript-eslint/parser',
     '@typescript-eslint/utils',
     '@typescript-eslint/rule-tester',
     '@typescript-eslint/typescript-estree',
     '@typescript-eslint/eslint-plugin',
     'typescript-eslint',
     "typescript"
    ],
    plugins: [dts()],
})
.then(() => {
    console.timeEnd('build time')
    console.log('✅ build done')
})
.catch((e) => console.error('❌ build failed', e));
