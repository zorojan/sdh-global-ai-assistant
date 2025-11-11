
export enum AppMode {
  LiveChat = 'LiveChat',
  TTS = 'TTS',
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export enum LiveChatStatus {
  Idle = 'Idle',
  Connecting = 'Connecting',
  Listening = 'Listening',
  Waiting = 'Waiting for response',
  Speaking = 'Speaking',
  Error = 'Error',
}
