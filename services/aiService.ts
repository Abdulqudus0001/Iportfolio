import { supabase } from './supabaseClient';

export const aiService = {
  startChatStream: async function* (message: string, history: any[]) {
    try {
      const { data, error } = await supabase.functions.invoke('api-proxy', {
        body: { command: 'startChatStream', payload: { message, history } },
      });

      if (error) {
        console.error("Error invoking stream function:", error);
        // Try to parse the error message from the function response
        let errorMessage = "Error connecting to the AI assistant.";
        if (error.message) {
            try {
                const parsed = JSON.parse(error.message);
                if(parsed.error) errorMessage = parsed.error;
            } catch (e) {
                errorMessage = error.message;
            }
        }
        yield { text: `Sorry, I encountered an issue: ${errorMessage}` };
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

    } catch (err: any) {
      console.error("Error in chat stream:", err);
      const errorMessage = err.message || "Sorry, I'm having trouble connecting to the AI service right now.";
      yield { text: `Sorry, I encountered an issue: ${errorMessage}` };
    }
  },
  resetChat: () => {
    // No longer needed with this architecture
  }
};