/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare const __PROJECT_CWD__: string;

interface Window {
  pdfjsLib?: any;
  GEMINI_API_KEY?: string;
  TiamoImageEditor?: any;
}
