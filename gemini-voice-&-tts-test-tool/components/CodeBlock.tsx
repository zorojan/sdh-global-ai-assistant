import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from '../constants';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, (err) => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="relative bg-gray-900/70 rounded-md my-2 text-white">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded flex items-center gap-1.5 z-10"
        aria-label="Copy code to clipboard"
      >
        {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="p-4 pt-8 overflow-x-auto text-sm">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  );
};
