import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
export const CHAT_MODEL = "gemini-2.5-flash";

export default ai;
