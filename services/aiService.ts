import { supabase } from './supabaseClient';

export const aiService = {
  startChatStream: async function* (message: string, history: any[]) {
    try {
      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: { command: 'startChatStream', payload: { message, history } },
        responseType: 'stream',
      });

      if (error) {
        console.error("Error invoking stream function:", error);
        yield { text: "Error connecting to the AI assistant." };
        return;
      }
      
      if (!data?.body) {
        yield { text: "Received an empty response from the AI assistant." };
        return;
      }

      const reader = data.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        yield { text: chunk };
      }

    } catch (err) {
      console.error("Error in chat stream:", err);
      yield { text: "Sorry, I'm having trouble connecting to the AI service right now." };
    }
  },
  resetChat: () => {
    // No longer needed with this architecture
  }
};