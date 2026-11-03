/// <reference types="nativewind/types" />

// global.css is read by NativeWind at build time; TypeScript 6 checks
// side-effect imports, so it needs to know .css files exist.
declare module '*.css'
