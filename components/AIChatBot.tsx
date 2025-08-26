import React, { useState, useRef, useEffect } from 'react';
import Button from './ui/Button';
import { View } from '../types';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/AuthContext';


type Message = {
    role: 'user' | 'model';
    content: string;
    actions?: Action[];
};

type Action = {
    label: string;
    type: 'nav' | 'prompt';
    value: string;
}

interface AIChatBotProps {
    isOpen: boolean;
    onClose: () => void;
    initialPrompt?: string;
    setCurrentView: (view: View) => void;
}

const AIChatBot: React.FC<AIChatBotProps> = ({ isOpen, onClose, initialPrompt, setCurrentView }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { session, user } = useAuth();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;
        return () => { 
            isMounted.current = false; 
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            if(initialPrompt){
                sendMessage(initialPrompt, true);
            } else {
                 setMessages([{ role: 'model', content: "Hello! I'm your AI financial assistant. How can I help you understand your portfolio better today?" } as Message]);
            }
        } else {
            setMessages([]); // Clear messages when closed
        }
    }, [isOpen, initialPrompt]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const parseActions = (text: string): { cleanText: string; actions: Action[] } => {
        const actions: Action[] = [];
        const regex = /\[action:([^|]+)\|([^:]+):([^\]]+)\]/g;
        const cleanText = text.replace(regex, (match, label, type, value) => {
            if (type === 'nav' || type === 'prompt') {
                actions.push({ label, type, value });
            }
            return ''; // Remove the tag from the displayed text
        }).trim();
        return { cleanText, actions };
    };


    const sendMessage = async (messageContent: string, isHiddenUserMessage: boolean = false) => {
        if (!user) {
             setMessages(prev => [...prev, { role: 'model', content: "You need to be signed in to use the AI Co-Pilot." } as Message]);
             return;
        }
        if (isLoading) return;

        setIsLoading(true);
        setInput('');

        const currentMessages: Message[] = isHiddenUserMessage 
            ? messages 
            : [...messages, { role: 'user', content: messageContent } as Message];

        if(!isHiddenUserMessage) {
            setMessages(currentMessages);
        }
        
        setMessages(prev => [...prev, { role: 'model', content: '' } as Message]);

        try {
            const token = session?.access_token;
            if (!token) throw new Error("Authentication token not found.");
            
            const history = currentMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            const stream = await aiService.startChatStream(messageContent, history, token);
            let fullResponse = '';

            for await (const chunk of stream) {
                if (!isMounted.current) break;

                fullResponse += chunk.text;

                const { cleanText, actions } = parseActions(fullResponse);
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if(lastMessage) {
                       lastMessage.content = cleanText;
                       lastMessage.actions = actions;
                    }
                    return newMessages;
                });
            }

        } catch (error: any) {
             if (!isMounted.current) {
                 console.log('AI chat aborted');
                 return;
             }
            console.error("AI Service error:", error);
            const errorMessage: Message = { role: 'model', content: "Sorry, I encountered an error. Please try again." };
            setMessages(prev => {
                const newMessages = [...prev];
                if (newMessages[newMessages.length - 1]?.content === '') {
                    newMessages.pop();
                }
                return [...newMessages, errorMessage];
            });
        } finally {
             if (isMounted.current) {
                 setIsLoading(false);
             }
        }
    };

    const handleActionClick = (action: Action) => {
        if (action.type === 'nav') {
            setCurrentView(action.value as View);
            onClose();
        } else if (action.type === 'prompt') {
            sendMessage(action.value);
        }
    };

    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex justify-center items-end sm:items-center" onClick={onClose}>
            <div className="bg-light-card dark:bg-dark-card rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-lg h-[80vh] flex flex-col"
                 onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-brand-primary">AI Co-Pilot</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white text-2xl">&times;</button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-light-bg dark:bg-dark-bg space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`rounded-lg px-4 py-2 max-w-sm ${msg.role === 'user' ? 'bg-brand-secondary text-white' : 'bg-gray-200 text-light-text dark:bg-gray-700 dark:text-dark-text'}`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                            {!isLoading && msg.actions && msg.actions.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {msg.actions.map((action, i) => (
                                        <button key={i} onClick={() => handleActionClick(action)} className="text-xs bg-blue-100 hover:bg-blue-200 text-brand-primary dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 font-semibold py-1 px-2 rounded-full">
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                     {isLoading && messages[messages.length-1]?.role === 'model' && messages[messages.length-1]?.content === '' && (
                        <div className="flex justify-start">
                            <div className="rounded-lg px-4 py-2 bg-gray-200 text-light-text dark:bg-gray-700 dark:text-dark-text">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75"></div>
                                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t dark:border-gray-700">
                    <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex space-x-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask a financial question..."
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-accent dark:bg-dark-bg dark:border-gray-600"
                            disabled={isLoading || !user}
                        />
                        <Button type="submit" disabled={isLoading || !input || !user}>Send</Button>
                    </form>
                     <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
                        AI-generated content is for informational purposes only and is not financial advice.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIChatBot;