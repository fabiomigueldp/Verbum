import React, { useRef, useEffect } from 'react';

interface DictationInputProps {
  text: string;
  setText: (text: string) => void;
  interimTranscript: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const DictationInput: React.FC<DictationInputProps> = ({
  text,
  setText,
  interimTranscript,
  placeholder = "Enter text...",
  className = "",
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  // Sync content when text or interimTranscript changes
  useEffect(() => {
    if (editorRef.current && !isComposingRef.current) {
      // If we have interim transcript, we show it
      if (interimTranscript) {
         // Clear and rebuild
         editorRef.current.innerHTML = '';

         // Final text part
         const textNode = document.createTextNode(text);
         editorRef.current.appendChild(textNode);

         // Interim part (styled)
         const interimSpan = document.createElement('span');
         interimSpan.className = 'opacity-50 italic transition-all duration-200';
         interimSpan.textContent = " " + interimTranscript; // Add space
         editorRef.current.appendChild(interimSpan);
      } else {
        // Just text, but preserve cursor if possible?
        // Actually, updating innerText resets cursor.
        // If we are typing, we shouldn't force update from 'text' unless it changed externally.
        // But here 'text' is controlled.

        // Check if content matches to avoid cursor reset
        if (editorRef.current.innerText !== text) {
             editorRef.current.innerText = text;
        }
      }
    }
  }, [text, interimTranscript]);

  const handleInput = () => {
    if (editorRef.current) {
      // Extract only the raw text, ignoring HTML structure
      const content = editorRef.current.innerText;
      // We don't want to include the interim part in the 'text' state if we can help it,
      // but 'innerText' will capture it.
      // However, usually input happens when NOT dictating.
      // If dictating, interimTranscript is present.
      // If user types WHILE dictating, it gets messy.
      // Let's assume user types when not dictating.
      if (!interimTranscript) {
          setText(content);
      }
    }
  };

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      onInput={handleInput}
      onCompositionStart={() => isComposingRef.current = true}
      onCompositionEnd={() => {
        isComposingRef.current = false;
        handleInput();
      }}
      className={`w-full bg-transparent border-none outline-none resize-none font-sans text-lg leading-relaxed ${
        !text && !interimTranscript ? 'text-white/30' : 'text-white/90'
      } ${className}`}
      style={{
        minHeight: '120px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
      // Hack for placeholder
      data-placeholder={placeholder}
    />
  );
};
