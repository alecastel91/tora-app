import React, { useState } from 'react';
import { motion } from 'framer-motion';
import apiService from '../../services/api';

const ForgotPasswordScreen = ({ onBackToLogin }) => {
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
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed inset-0 flex items-start justify-center bg-black px-5 py-5 overflow-y-auto"
    >
      <div className="w-full max-w-md my-5">
        <div className="text-center mb-12">
          <img
            src="/tora_logo.png"
            alt="TORA"
            className="max-w-[200px] md:max-w-[220px] h-auto mb-3 mx-auto block"
          />
          <p className="text-white text-[10px] md:text-[12px] tracking-[0.22em] font-normal mt-2 whitespace-nowrap uppercase">
            RESET YOUR PASSWORD
          </p>
        </div>

        {submitted ? (
          <div className="bg-transparent">
            <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-6 mb-6 text-white text-[14px] leading-relaxed">
              If an account exists for <strong>{email}</strong>, we've sent a reset link.
              Check your inbox — the link expires in 60 minutes.
            </div>
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-sm border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Back to Log In
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
              Enter your account email and we'll send you a link to choose a new password.
            </p>

            <div className="mb-6">
              <input
                type="email"
                name="email"
                placeholder="Email"
                aria-label="Email"
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
              className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-sm border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'SENDING…' : 'SEND RESET LINK'}
            </button>

            <div className="text-center mt-5 text-[13px] font-normal">
              <button
                type="button"
                onClick={onBackToLogin}
                className="text-gray-400 hover:text-white underline bg-transparent border-none cursor-pointer font-normal transition-colors duration-200"
              >
                Back to Log In
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
};

export default ForgotPasswordScreen;
