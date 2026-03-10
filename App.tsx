import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { InputForm } from './components/InputForm';
import { LoadingScreen } from './components/LoadingScreen';
import { ResultsDisplay } from './components/ResultsDisplay';
import { CaptionsDisplay } from './components/CaptionsDisplay';
import { VideoPlan, SocialMediaCaptions } from './types';
import { generateVideoPlan, generateImages, generateVoiceover, generateSocialMediaCaptions } from './services/geminiService';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [videoPlan, setVideoPlan] = useState<VideoPlan | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[] | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [socialMediaCaptions, setSocialMediaCaptions] = useState<SocialMediaCaptions | null>(null);

  const handleGenerateReel = useCallback(async (userInput: string) => {
    if (!userInput.trim()) {
      setError('Please enter a legendary topic or idea.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVideoPlan(null);
    setGeneratedImages(null);
    setAudioData(null);
    setSocialMediaCaptions(null);

    try {
      const handleProgress = (message: string) => {
        setLoadingMessage(message);
      };

      setLoadingMessage('Act 1: Generating a viral script...');
      const plan = await generateVideoPlan(userInput, handleProgress);
      setVideoPlan(plan);

      setLoadingMessage('Act 2: Summoning stunning visuals... This may take a minute.');
      const imagePrompts = plan.scenes.map(scene => scene.imagePrompt);
      const images = await generateImages(imagePrompts, handleProgress);
      setGeneratedImages(images);

      setLoadingMessage('Act 3: Recording professional voiceover...');
      const audioB64 = await generateVoiceover(plan.script);
      setAudioData(audioB64);

      setLoadingMessage('Act 4: Crafting viral social media captions...');
      const captions = await generateSocialMediaCaptions(plan);
      setSocialMediaCaptions(captions);

      setLoadingMessage('Final Act: Assembling your masterpiece...');
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error(e);
      setError(`Failed to generate reel: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, []);

  return (
    <div className="app-container">
      <main className="main-content">
        <Header />

        <InputForm onSubmit={handleGenerateReel} isLoading={isLoading} />

        <AnimatePresence>
          {error && (
            <motion.div
              className="error-box"
              initial={{ opacity: 0, height: 0, scale: 0.9 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.9 }}
            >
              <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>System Malfunction</h3>
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isLoading && <LoadingScreen message={loadingMessage} />}
        </AnimatePresence>

        {!isLoading && videoPlan && generatedImages && audioData && (
          <motion.div
            className="results-section"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <ResultsDisplay videoPlan={videoPlan} images={generatedImages} audioData={audioData} />
            {socialMediaCaptions && <CaptionsDisplay captions={socialMediaCaptions} />}
          </motion.div>
        )}
      </main>

      <footer className="footer">
        <p>Engineered autonomously with the pulse of AI • Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;
