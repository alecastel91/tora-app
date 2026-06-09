import React, { useState, useEffect } from 'react';
import apiService from '../../services/api';
import IntroSplash from '../common/IntroSplash';
import { motion } from 'framer-motion';

const LoginScreen = ({ onLoginSuccess, onSwitchToSignup, onSwitchToForgotPassword }) => {
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
      setError(err.message || 'Login failed. Please try again.');
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
      <div className="w-full max-w-md my-5">
        {/* Header with Logo and Tagline */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <img
            src="/tora_logo.png"
            alt="TORA"
            className="max-w-[200px] md:max-w-[220px] h-auto mb-3 mx-auto block"
          />
          <p className="text-white text-[10px] md:text-[12px] tracking-[0.22em] font-normal mt-2 whitespace-nowrap uppercase">
            WHERE MUSIC MEETS
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
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-6 text-red-400 text-[13px] leading-relaxed">
              {error}
            </div>
          )}

          {/* Email Input */}
          <div className="mb-4">
            <input
              type="email"
              name="email"
              placeholder="Email"
              aria-label="Email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3.5 bg-black border border-[#333333] rounded-lg text-white text-[15px] font-rajdhani tracking-[0.1em] placeholder:text-[#666666] focus:outline-none focus:border-primary-pink transition-all duration-200 ease-in-out"
            />
          </div>

          {/* Password Input */}
          <div className="mb-2">
            <input
              type="password"
              name="password"
              placeholder="Password"
              aria-label="Password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3.5 bg-black border border-[#333333] rounded-lg text-white text-[15px] font-rajdhani tracking-[0.1em] placeholder:text-[#666666] focus:outline-none focus:border-primary-pink transition-all duration-200 ease-in-out"
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right mb-6">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-[12px] text-gray-400 hover:text-primary-pink underline bg-transparent border-none cursor-pointer transition-colors duration-200"
            >
              Forgot password?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-sm border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'LOGGING IN...' : 'LOG IN'}
          </button>

          {/* Activate (with invitation code) */}
          <div className="text-center mt-5 text-[13px] font-normal">
            <span className="text-gray-400">Have an invitation? </span>
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-primary-pink hover:text-primary-pink-hover underline bg-transparent border-none cursor-pointer font-normal transition-colors duration-200"
            >
              Activate your account
            </button>
          </div>

          {/* Apply (no invitation yet) */}
          <div className="text-center mt-2 text-[13px] font-normal">
            <span className="text-gray-400">New to TORA? </span>
            <a
              href={import.meta.env.VITE_APPLY_URL || 'https://torahub.io/apply'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white underline cursor-pointer font-normal transition-colors duration-200"
            >
              Apply for membership
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