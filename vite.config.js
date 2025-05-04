import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [glsl()],
  assetsInclude: ['**/*.exr'],
  build: {
    assetsInlineLimit: 0, // Don't inline assets into JS
    rollupOptions: {
      output: {
        manualChunks: {
          // Group textures together
          cracked_boulder: [
            'public/rock_textures/cracked_boulder/cracked_boulder_diff.jpg',
            'public/rock_textures/cracked_boulder/cracked_boulder_disp.png',
            'public/rock_textures/cracked_boulder/cracked_boulder_nor_gl.exr',
          ],
          coast: [
            'public/rock_textures/coast/coast_diff.jpg',
            'public/rock_textures/coast/coast_disp.png',
            'public/rock_textures/coast/coast_nor_gl.exr',
          ],
          slate: [
            'public/rock_textures/slate/slate_diff.jpg',
            'public/rock_textures/slate/slate_disp.png',
            'public/rock_textures/slate/slate_nor_gl.exr'
          ]
        }
      }
    }
  }
});
