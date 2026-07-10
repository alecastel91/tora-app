import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import IntroSplash from '../common/IntroSplash';
import { motion } from 'framer-motion';
import { useLanguage } from '../../contexts/LanguageContext';

const LoginScreen = ({ onLoginSuccess, onSwitchToSignup, onSwitchToForgotPassword }) => {
  const { t } = useLanguage();
  const [showIntro, setShowIntro] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Show form after dissolve starts (2.5s) so it fades in as splash fades out
    const formTimer = setTimeout(() => setShowForm(true), 2800);
    // Hide intro after dissolve completes
    const introTimer = setTimeout(() => setShowIntro(false), 3500);

    return () => {
      clearTimeout(formTimer);
      clearTimeout(introTimer);
    };
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiService.login(formData.email, formData.password);
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Intro Splash - stays visible during transition */}
      {showIntro && <IntroSplash />}

      {/* Login Form - fades in while logo is sliding */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="fixed inset-0 flex items-start justify-center bg-black px-5 py-5 overflow-y-auto"
        >
      {/* quiet-premium backdrop: faint crimson bloom + engineering grid fading out */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72
                   bg-[radial-gradient(60%_100%_at_50%_0%,rgba(255,51,102,0.06),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-grid
                   [mask-image:radial-gradient(70%_100%_at_50%_0%,black,transparent)]"
      />
      <div className="relative w-full max-w-md my-5">
        {/* Header with Logo and Tagline */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-10"
        >
          <img
            src="/tora_logo.png"
            alt="TORA"
            className="max-w-[190px] md:max-w-[210px] h-auto mb-3 mx-auto block mix-blend-screen"
          />
          <p className="text-white/70 text-[10px] md:text-[11px] tracking-[0.25em] font-normal mt-2 whitespace-nowrap uppercase font-tech">
            {t('auth.tagline')}
          </p>
        </motion.div>

        {/* Login Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className="bg-transparent py-0 px-0"
          onSubmit={handleSubmit}
        >
          {/* Error Message */}
          {error && (
            <div className="bg-infrared/[0.08] border border-infrared/40 rounded-xl px-4 py-3 mb-5 text-infrared text-[13px] leading-relaxed">
              {error}
            </div>
          )}

            {/* Email Input */}
            <div className="mb-3">
              <input
                type="email"
                name="email"
                placeholder={t('auth.email')}
                aria-label={t('auth.email')}
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm
                           placeholder:text-white/35 focus:outline-none focus:border-infrared/60 focus:bg-white/[0.04]
                           transition-colors duration-300"
              />
            </div>

            {/* Password Input */}
            <div className="mb-2">
              <input
                type="password"
                name="password"
                placeholder={t('auth.password')}
                aria-label={t('auth.password')}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm
                           placeholder:text-white/35 focus:outline-none focus:border-infrared/60 focus:bg-white/[0.04]
                           transition-colors duration-300"
              />
            </div>

            {/* Forgot Password Link */}
            <div className="text-right mb-5">
              <button
                type="button"
                onClick={onSwitchToForgotPassword}
                className="text-[12px] text-white/40 hover:text-infrared bg-transparent border-none cursor-pointer transition-colors duration-200"
              >
                {t('auth.forgotPassword')}
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-infrared/[0.08] border border-infrared/45 rounded-xl text-white text-[11px]
                         font-semibold uppercase tracking-[0.15em] font-tech cursor-pointer transition-all duration-300
                         hover:bg-infrared/15 hover:border-infrared/70 active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('auth.loggingIn') : t('auth.logIn')}
            </button>

          {/* Activate (with invitation code) */}
          <div className="text-center mt-6 text-[13px] font-normal">
            <span className="text-white/40">{t('auth.haveInvitation')} </span>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-infrared hover:opacity-80 underline underline-offset-2 bg-transparent border-none cursor-pointer font-normal transition-opacity duration-200"
            >
              {t('auth.activateAccount')}
            </button>
          </div>

          {/* Apply (no invitation yet) */}
          <div className="text-center mt-2 text-[13px] font-normal">
            <span className="text-white/40">{t('auth.newToTora')} </span>
            <a
              href={import.meta.env.VITE_APPLY_URL || 'https://torahub.io/apply'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/60 hover:text-white underline underline-offset-2 cursor-pointer font-normal transition-colors duration-200"
            >
              {t('auth.applyMembership')}
            </a>
          </div>

        </motion.form>
      </div>
    </motion.div>
      )}
    </>
  );
};

export default LoginScreen;