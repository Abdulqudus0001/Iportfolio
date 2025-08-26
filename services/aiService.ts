import { supabase } from './supabaseClient';

export const aiService = {
  startChatStream: async (message: string, history: any[], token: string) => {
    try {
        const { data, error } = await supabase.functions.invoke('secure-api-gateway', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
                action: 'chat-ai',
                payload: { message, history }
            }
        });

        if (error) {
            throw new Error(`Function invocation failed: ${error.message}`);
        }
        
        if (!data || !data.body) {
            throw new Error("No response body from function.");
        }

        const reader = data.body.getReader();
        const decoder = new TextDecoder();

        return (async function* () {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const json = JSON.parse(line.substring(6));
                            yield json;
                        } catch(e) {
                             console.error("Failed to parse stream chunk JSON:", e, "Chunk:", line);
                        }
                    }
                }
            }
        })();

    } catch (error) {
        console.error("AI Service stream error:", error);
        throw new Error("Failed to get response from AI service.");
    }
  },
  resetChat: () => {
    // No longer needed as the backend is stateless per request
  }
};