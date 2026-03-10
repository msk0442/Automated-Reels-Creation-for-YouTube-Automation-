import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <motion.header
      className="header"
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut"
        }}
        style={{ display: 'inline-block', marginBottom: '1rem' }}
      >
        <Sparkles size={48} color="var(--accent-1)" />
      </motion.div>
      <h1 className="text-gradient">Automated Reels<br />Creator</h1>
      <p>
        The ultimate AI powerhouse. Transform absolute zero into hyper-engaging, viral social media video reels with one simple click. Fully autonomous.
      </p>
    </motion.header>
  );
};
