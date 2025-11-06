/**
 * Gemini Live API Diagnostic Tool
 * Tests different configurations to identify why sessions close immediately
 */

import { GoogleGenAI, Modality } from '@google/genai';

export class GeminiLiveDiagnostic {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
    console.log('🔍 Gemini Live Diagnostic: Initialized');
  }

  async testBasicConnection(): Promise<boolean> {
    console.log('🧪 Test 1: Basic Connection Test');
    
    try {
      const session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {
            console.log('✅ Test 1: Session opened successfully');
          },
          onmessage: (message) => {
            console.log('📨 Test 1: Message:', message);
          },
          onclose: (event) => {
            console.warn('❌ Test 1: Session closed:', event);
          },
          onerror: (error) => {
            console.error('❌ Test 1: Session error:', error);
          }
        }
      });

      // Wait a bit to see if session stays open
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (session) {
        await session.close();
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('❌ Test 1 Failed:', error);
      return false;
    }
  }

  async testMinimalConfig(): Promise<boolean> {
    console.log('🧪 Test 2: Minimal Configuration');
    
    try {
      const session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {},
        callbacks: {
          onopen: () => {
            console.log('✅ Test 2: Minimal config session opened');
          },
          onmessage: (message) => {
            console.log('📨 Test 2: Message:', message);
          },
          onclose: (event) => {
            console.warn('❌ Test 2: Minimal config session closed:', event);
          },
          onerror: (error) => {
            console.error('❌ Test 2: Minimal config error:', error);
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (session) {
        await session.close();
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('❌ Test 2 Failed:', error);
      return false;
    }
  }

  async testDifferentModel(): Promise<boolean> {
    console.log('🧪 Test 3: Different Model');
    
    try {
      const session = await this.ai.live.connect({
        model: 'gemini-2.5-flash',
        config: {
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {
            console.log('✅ Test 3: Different model session opened');
          },
          onmessage: (message) => {
            console.log('📨 Test 3: Message:', message);
          },
          onclose: (event) => {
            console.warn('❌ Test 3: Different model session closed:', event);
          },
          onerror: (error) => {
            console.error('❌ Test 3: Different model error:', error);
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (session) {
        await session.close();
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('❌ Test 3 Failed:', error);
      return false;
    }
  }

  async testWithoutAudio(): Promise<boolean> {
    console.log('🧪 Test 4: Without Audio Modality');
    
    try {
      const session = await this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction: 'You are a helpful AI assistant.',
        },
        callbacks: {
          onopen: () => {
            console.log('✅ Test 4: No audio modality session opened');
          },
          onmessage: (message) => {
            console.log('📨 Test 4: Message:', message);
          },
          onclose: (event) => {
            console.warn('❌ Test 4: No audio modality session closed:', event);
          },
          onerror: (error) => {
            console.error('❌ Test 4: No audio modality error:', error);
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (session) {
        await session.close();
        return true;
      }
      return false;
      
    } catch (error) {
      console.error('❌ Test 4 Failed:', error);
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Running Gemini Live Diagnostic Tests...');
    
    const results = {
      basicConnection: await this.testBasicConnection(),
      minimalConfig: await this.testMinimalConfig(),
      differentModel: await this.testDifferentModel(),
      withoutAudio: await this.testWithoutAudio()
    };

    console.log('\n📊 Diagnostic Results:');
    console.log('Basic Connection:', results.basicConnection ? '✅' : '❌');
    console.log('Minimal Config:', results.minimalConfig ? '✅' : '❌');
    console.log('Different Model:', results.differentModel ? '✅' : '❌');
    console.log('Without Audio:', results.withoutAudio ? '✅' : '❌');

    if (!Object.values(results).some(Boolean)) {
      console.log('\n💡 Recommendations:');
      console.log('1. Check if your API key has access to Gemini Live API');
      console.log('2. Verify billing is enabled for your Google Cloud project');
      console.log('3. Check if Gemini Live API is available in your region');
      console.log('4. Try using a different API key or project');
    } else {
      console.log('\n💡 Some tests passed! The issue might be with specific configuration options.');
    }
  }
}