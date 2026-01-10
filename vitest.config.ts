import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    globalSetup: ['./src/test/globalSetup.ts'],
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      POSTGRES_DB: 'openskimap_test',
    },
  },
})
