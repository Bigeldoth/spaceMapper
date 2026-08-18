import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Tauri sert le frontend depuis un port fixe et attend un échec franc si
  // celui-ci est déjà pris, plutôt qu'un basculement silencieux.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // `src-tauri` est surveillé par cargo, pas par Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
});
