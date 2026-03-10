import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wand2, Loader2 } from 'lucide-react';

interface InputFormProps {
  onSubmit: (userInput: string) => void;
  isLoading: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading }) => {
  const [userInput, setUserInput] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(userInput);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="glass-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <div className="form-group">
        <label htmlFor="userInput" className="form-label text-gradient">
          What is your ultimate video idea?
        </label>
        <textarea
          id="userInput"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Unleash an insanely viral idea here..."
          className="textarea-input"
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || !userInput.trim()}
        className="btn-primary"
      >
        {isLoading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Loader2 size={24} />
            </motion.div>
            <span>Forging Masterpiece...</span>
          </>
        ) : (
          <>
            <Wand2 size={24} />
            <span>Generate Viral Reel</span>
          </>
        )}
      </button>
    </motion.form>
  );
};
