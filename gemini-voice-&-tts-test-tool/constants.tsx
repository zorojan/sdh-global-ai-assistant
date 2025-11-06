import React from 'react';

export const LIVE_CHAT_MODELS = [
  'gemini-2.5-flash-native-audio-preview-09-2025'
];

export const TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
];

export const TTS_VOICES = [
  'Kore',
  'Puck',
  'Charon',
  'Fenrir',
  'Zephyr',
  'Armenian',
];

export const MicrophoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM10.5 5a1.5 1.5 0 0 1 3 0v6a1.5 1.5 0 0 1-3 0V5Z" />
    <path d="M12 16.5A4.5 4.5 0 0 1 7.5 12H6a6 6 0 0 0 5.25 5.95V21h1.5v-3.05A6 6 0 0 0 18 12h-1.5a4.5 4.5 0 0 1-4.5 4.5Z" />
  </svg>
);

export const StopIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
    </svg>
);

export const PlayIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
    </svg>
);

export const SpeakerIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 1 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
        <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
    </svg>
);

export const CopyIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.5 3a.75.75 0 0 0-.75.75v12c0 .414.336.75.75.75h9a.75.75 0 0 0 .75-.75v-12a.75.75 0 0 0-.75-.75h-9ZM9 4.5h6v10.5H9V4.5Z" />
        <path d="M4.5 6.75A.75.75 0 0 0 3.75 6V3.75A2.25 2.25 0 0 1 6 1.5h10.5a.75.75 0 0 0 0-1.5H6A3.75 3.75 0 0 0 2.25 3.75v15A3.75 3.75 0 0 0 6 22.5h1.5a.75.75 0 0 0 0-1.5H6A2.25 2.25 0 0 1 3.75 18.75V8.25a.75.75 0 0 0-.75-.75H4.5Z" />
    </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
    </svg>
);