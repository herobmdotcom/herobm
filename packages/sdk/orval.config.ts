import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    output: {
      mode: 'tags-split',
      target: 'src/endpoints',
      schemas: 'src/model',
      client: 'fetch',
      clean: true,
      mock: false,
      override: {
        mutator: {
          path: 'src/mutator.ts',
          name: 'customFetch',
        },
      },
      indexFiles: true,
    },
    input: {
      target: '../../docs/developers/openapi.json',
    },
  },
});

