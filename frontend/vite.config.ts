import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      base: isProduction ? '/' : '/',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.VITE_API_URL': JSON.stringify(
          isProduction ? '/api' : 'http://localhost:3001/api'
        )
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            widget: path.resolve(__dirname, 'widget.html')
          }
        }
      },
      server: {
        proxy: isProduction ? undefined : {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true
          }
        }
      }
    };
});
