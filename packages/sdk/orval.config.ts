import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    output: {
      mode: 'split',
      target: 'src/api.ts',
      schemas: 'src/model',
      client: 'fetch',
      mock: false,
      override: {
        mutator: {
          path: 'src/mutator.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: '../../docs/developers/openapi.json',
    },
  },
});
