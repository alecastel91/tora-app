import React, { useState } from 'react';
import AuthScreenShell from '../common/AuthScreenShell';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

const ForgotPasswordScreen = ({ onBackToLogin }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await apiService.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || t('auth.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell subtitle={t('auth.resetYourPassword')}>
      {submitted ? (
        <div className="bg-transparent">
          <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-6 mb-6 text-white text-[14px] leading-relaxed">
            {t('auth.resetLinkSentBefore')} <strong>{email}</strong>{t('auth.resetLinkSentAfter')}
          </div>
          <button
            type="button"
            onClick={onBackToLogin}
            className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-xs border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('auth.backToLogin')}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-transparent">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-6 text-red-400 text-[13px] leading-relaxed">
              {error}
            </div>
          )}

          <p className="text-gray-400 text-[13px] leading-relaxed mb-6">
            {t('auth.forgotIntro')}
          </p>

          <div className="mb-6">
            <input
              type="email"
              name="email"
              placeholder={t('auth.email')}
              aria-label={t('auth.email')}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 bg-black border border-[#333333] rounded-lg text-white text-[15px] font-rajdhani tracking-[0.1em] placeholder:text-[#666666] focus:outline-none focus:border-primary-pink transition-all duration-200 ease-in-out"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-xs border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth.sending') : t('auth.sendResetLink')}
          </button>

          <div className="text-center mt-5 text-[13px] font-normal">
            <button
              type="button"
              onClick={onBackToLogin}
              className="text-gray-400 hover:text-white underline bg-transparent border-none cursor-pointer font-normal transition-colors duration-200"
            >
              {t('auth.backToLogin')}
            </button>
          </div>
        </form>
      )}
    </AuthScreenShell>
  );
};

export default ForgotPasswordScreen;
