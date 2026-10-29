/// <reference types="vite/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

interface Window {
  pdfjsLib?: any;
  GEMINI_API_KEY?: string;
  TiamoImageEditor?: any;
  MyImageEditor?: any;
}
