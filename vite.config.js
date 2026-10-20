import { defineConfig } from 'vite';

// Relative base works for GitHub Pages root, project pages and PR previews.
// Override with BASE_PATH (e.g. /hallel34/pr-preview/pr-7/) when needed.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
