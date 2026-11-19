/**
 * Tipos mínimos de pdfjs-dist para el navegador. El paquete no trae
 * declaraciones para la ruta `build/pdf.mjs`, y solo usamos tres cosas.
 */

declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };

  export interface TextItem {
    str?: string;
  }

  export interface PdfPage {
    getTextContent(): Promise<{ items: TextItem[] }>;
  }

  export interface PdfDocument {
    numPages: number;
    getPage(page: number): Promise<PdfPage>;
  }

  export function getDocument(source: {
    data: Uint8Array;
    useSystemFonts?: boolean;
    verbosity?: number;
  }): { promise: Promise<PdfDocument> };
}
