export const BASE = "http://localhost:8000";

export const LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "fr-FR", label: "French" },
  { code: "es-ES", label: "Spanish" },
  { code: "de-DE", label: "German" },
  { code: "ar-SA", label: "Arabic" },
  { code: "zh-CN", label: "Chinese (CN)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "pt-BR", label: "Portuguese (BR)" },
  { code: "ko-KR", label: "Korean" },
  { code: "ru-RU", label: "Russian" },
];

export const DEFAULT_SYSTEM = `You are a helpful AI assistant that answers questions strictly based on document context.
Rules:
1. Only use information from the CONTEXT block.
2. If the answer is not in the context, say 'Not found in the document'.
3. Be concise. Use bullet points when listing multiple items.
4. Never make up information.`;

export const DEFAULT_USER = `Answer my question based on the uploaded documents. Be clear and concise.`;
