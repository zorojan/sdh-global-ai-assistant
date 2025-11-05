import React, { useEffect, useState } from 'react';
import ChatWidget from './ChatWidget';

const Widget: React.FC = () => {
  const [config, setConfig] = useState({
    agentId: '',
    theme: 'light' as 'light' | 'dark',
    position: 'bottom-right' as 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
    title: 'AI Assistant',
    placeholder: 'Type your message...',
    primaryColor: '#007bff',
    apiUrl: 'http://localhost:3001',
    geminiApiKey: 'demo-key',
    aiProvider: 'gemini'
  });

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    const newConfig = {
      agentId: urlParams.get('agentId') || '',
      theme: (urlParams.get('theme') as 'light' | 'dark') || 'light',
      position: (urlParams.get('position') as any) || 'bottom-right',
      title: urlParams.get('title') || 'AI Assistant',
      placeholder: urlParams.get('placeholder') || 'Type your message...',
      primaryColor: urlParams.get('primaryColor') || '#007bff',
      apiUrl: urlParams.get('apiUrl') || 'http://localhost:3001',
      geminiApiKey: urlParams.get('geminiApiKey') || 'demo-key'
      ,
      aiProvider: (urlParams.get('ai_provider') as 'gemini' | 'openai' | 'hybrid') || 'gemini'
    };

    setConfig(newConfig);

    // Apply theme to body for iframe
    document.body.className = `widget-page ${newConfig.theme}`;
    
    // Set CSS custom properties for theming
    document.documentElement.style.setProperty('--primary-color', newConfig.primaryColor);
    
    // Calculate darker shade for hover states
    const primaryColorDark = adjustColor(newConfig.primaryColor, -20);
    document.documentElement.style.setProperty('--primary-color-dark', primaryColorDark);

  }, []);

  // Helper function to darken color
  const adjustColor = (color: string, amount: number): string => {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    
    if (col.length !== 6) return color;
    
    const r = parseInt(col.substring(0, 2), 16);
    const g = parseInt(col.substring(2, 4), 16);
    const b = parseInt(col.substring(4, 6), 16);
    
    const newR = Math.max(0, Math.min(255, r + amount));
    const newG = Math.max(0, Math.min(255, g + amount));
    const newB = Math.max(0, Math.min(255, b + amount));
    
    const newCol = ((newR << 16) | (newG << 8) | newB).toString(16).padStart(6, '0');
    
    return (usePound ? '#' : '') + newCol;
  };

  if (!config.agentId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
        color: '#6c757d',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div>
          <h3>Widget Configuration Error</h3>
          <p>Agent ID is required. Please check your embedding code.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <ChatWidget
        agentId={config.agentId}
        theme={config.theme}
        position={config.position}
        title={config.title}
        placeholder={config.placeholder}
        primaryColor={config.primaryColor}
        apiUrl={config.apiUrl}
        geminiApiKey={config.geminiApiKey}
          aiProvider={config.aiProvider}
      />
    </div>
  );
};

export default Widget;
