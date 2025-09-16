import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-fix-html',
      writeBundle() {
        copyFileSync('src/extension/manifest.json', 'dist/manifest.json');
        
        // Fix HTML file references after Vite processes them
        import('fs').then(({ readFileSync, writeFileSync }) => {
          try {
            // Read the processed HTML file
            const htmlPath = 'dist/public/newtab.html';
            let htmlContent = readFileSync(htmlPath, 'utf-8');
            
            // Copy it to the root dist directory (where manifest expects it)
            writeFileSync('dist/newtab.html', htmlContent);
            console.log('✅ Fixed newtab.html file references');
          } catch (error) {
            console.warn('Could not fix HTML file:', error);
          }
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'public/newtab.html'),
        background: resolve(__dirname, 'src/extension/background.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js'
          }
          return '[name]-[hash].js'
        },
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'styles/[name]-[hash].[ext]'
          }
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].[ext]'
          }
          return '[name]-[hash].[ext]'
        }
      }
    },
    copyPublicDir: true,
    sourcemap: process.env.NODE_ENV === 'development',
    minify: process.env.NODE_ENV === 'production'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  server: {
    port: 5173
  }
})