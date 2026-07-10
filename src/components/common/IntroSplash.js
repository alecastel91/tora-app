import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

const IntroSplash = ({ onComplete }) => {
  const { t } = useLanguage();
  const [showContent, setShowContent] = useState(false);
  const [dissolve, setDissolve] = useState(false);

  useEffect(() => {
    // Content fades in
    const showTimer = setTimeout(() => setShowContent(true), 300);
    // Everything dissolves out
    const dissolveTimer = setTimeout(() => setDissolve(true), 2500);
    // Notify parent to show login
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 3300);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dissolveTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-black z-50"
      animate={{ opacity: dissolve ? 0 : 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="flex flex-col items-center text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
          animate={showContent ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-2"
        >
          <img
            src="/tora_logo.png"
            alt="TORA"
            className="w-[320px] md:w-[400px] h-auto"
          />
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={showContent ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
          className="text-center mt-2"
        >
          <p className="text-white text-[10px] md:text-[12px] tracking-[0.22em] font-normal uppercase whitespace-nowrap">
            {t('auth.tagline')}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default IntroSplash;
