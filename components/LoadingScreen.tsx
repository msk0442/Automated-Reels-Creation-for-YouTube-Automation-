import React from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  message: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => {
  return (
    <motion.div
      className="glass-card loader-container"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      style={{ marginTop: '2rem' }}
    >
      <div className="spinner"></div>
      <motion.p
        className="text-gradient loader-msg"
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {message}
      </motion.p>
      <p className="loader-submsg">This heavy lifting might take a minute. Hold tight!</p>
    </motion.div>
  );
};
