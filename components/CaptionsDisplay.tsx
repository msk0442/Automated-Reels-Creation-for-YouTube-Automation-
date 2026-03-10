import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { SocialMediaCaptions } from '../types';

interface CaptionsDisplayProps {
  captions: SocialMediaCaptions;
}

type Platform = keyof SocialMediaCaptions;

const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
};

export const CaptionsDisplay: React.FC<CaptionsDisplayProps> = ({ captions }) => {
  const [activeTab, setActiveTab] = useState<Platform>('instagram');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(captions[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTabClick = (platform: Platform) => {
    setActiveTab(platform);
    setCopied(false);
  }

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ marginTop: '2rem' }}
    >
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>Viral Captions 🚀</h2>

      <div className="tabs">
        {(Object.keys(captions) as Platform[]).map((platform) => (
          <button
            key={platform}
            onClick={() => handleTabClick(platform)}
            className={`tab ${activeTab === platform ? 'active' : ''}`}
          >
            {platformNames[platform]}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            className="caption-box"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {captions[activeTab]}
          </motion.div>
        </AnimatePresence>

        <button className="copy-btn" onClick={handleCopy}>
          {copied ? (
            <>
              <Check size={16} color="var(--accent-3)" />
              <span style={{ color: 'var(--accent-3)' }}>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              Copy
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
