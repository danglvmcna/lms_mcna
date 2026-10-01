// Vite resolves "<file>?url" imports to the served address of that file (used for the pdf.js worker).
declare module "*?url" {
  const src: string;
  export default src;
}
