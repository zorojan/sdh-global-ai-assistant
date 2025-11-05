/**
 * React Context for OpenAI Realtime API
 * Provides WebRTC-based real-time voice conversation capabilities
 */
import { createContext, FC, ReactNode, useContext } from 'react';
import { useOpenAIRealtime, UseOpenAIRealtimeResults } from '../hooks/media/use-openai-realtime';

const OpenAIRealtimeContext = createContext<UseOpenAIRealtimeResults | undefined>(undefined);

export type OpenAIRealtimeProviderProps = {
  children: ReactNode;
  apiUrl?: string;
};

export const OpenAIRealtimeProvider: FC<OpenAIRealtimeProviderProps> = ({
  apiUrl = 'http://localhost:3001',
  children,
}) => {
  const realtimeAPI = useOpenAIRealtime({ apiUrl });

  return (
    <OpenAIRealtimeContext.Provider value={realtimeAPI}>
      {children}
    </OpenAIRealtimeContext.Provider>
  );
};

export const useOpenAIRealtimeContext = () => {
  const context = useContext(OpenAIRealtimeContext);
  if (!context) {
    throw new Error('useOpenAIRealtimeContext must be used within an OpenAIRealtimeProvider');
  }
  return context;
};