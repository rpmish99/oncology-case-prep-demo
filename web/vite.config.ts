import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The synthetic record files live in ../data and are imported as text for the source viewer.
export default defineConfig({ plugins: [react()], server: { fs: { allow: [".."] } } });
