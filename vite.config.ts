import { defineConfig } from 'vitest/config';

// Relative base so the build works on GitHub Pages under /<repo>/.
export default defineConfig({
  base: './',
  test: { include: ['src/**/*.test.ts'] },
});
