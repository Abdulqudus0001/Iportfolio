
import { GoogleGenAI, Chat, GenerateContentResponse, Content } from "@google/genai";

// User-provided API key
const API_KEY = 'AIzaSyB_fb2sHjSes8MIgRcQUpK1jN77MdJZ_2g';

if (!API_KEY) {
  throw new Error("Gemini API key is missing. Please add it to services/aiService.ts");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-flash';

const systemInstruction = {
  role: 'user',
  parts: [{
    text: `You are an expert financial AI assistant for the iPortfolio application. Your goal is to help users understand finance and their portfolios.
- Be concise and clear.
- Do not give financial advice. Use disclaimers.
- You can suggest navigating the app. To do this, embed a special action tag in your response like this: [action:Navigate to Analytics|nav:analytics]. The format is [action:LABEL|TYPE:VALUE].
- Supported navigation pages are: 'dashboard', 'assets', 'portfolio', 'analytics', 'community', 'alerts', 'comparison'.
- You can also suggest follow-up prompts using the 'prompt' type, like this: [action:Explain Sharpe Ratio|prompt:Explain what the Sharpe Ratio is in simple terms].
- Always be helpful and professional.`
  }]
};

export const aiService = {
  /**
   * Starts or continues a chat stream with the Gemini model.
   * @param message The user's message.
   * @param history The existing chat history from the UI.
   * @returns An async iterator yielding stream chunks.
   */
  startChatStream: async (message: string, history: { role: 'user' | 'model', content: string }[]) => {
    
    const chatHistory: Content[] = [
      systemInstruction,
      // The model's first turn is implied by the system instruction.
    ];

    // Convert the component's history format to the SDK's format
    history.forEach(h => {
        chatHistory.push({
            role: h.role,
            parts: [{ text: h.content }]
        });
    });

    const chat = ai.chats.create({
      model,
      history: chatHistory
    });

    const result = await chat.sendMessageStream({ message });
    return result; // This is already an async iterator of GenerateContentResponse
  },
};
