import React, { useState } from 'react';
import { motion } from 'framer-motion';
import apiService from '../../services/api';

const ResetPasswordScreen = ({ token, onBackToLogin }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await apiService.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Reset failed. The link may have expired — request a new one.');
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
            CHOOSE A NEW PASSWORD
          </p>
        </div>

        {success ? (
          <div className="bg-transparent">
            <div className="bg-green-500/10 border border-green-500/40 rounded-lg px-5 py-6 mb-6 text-white text-[14px] leading-relaxed">
              ✅ Password updated. You can log in with your new password now.
            </div>
            <button
              type="button"
              onClick={onBackToLogin}
              className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-sm border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Go to Log In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-transparent">
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg px-4 py-3 mb-6 text-red-400 text-[13px] leading-relaxed">
                {error}
              </div>
            )}

            <div className="mb-4">
              <input
                type="password"
                name="newPassword"
                placeholder="New password (min 6 characters)"
                aria-label="New password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3.5 bg-black border border-[#333333] rounded-lg text-white text-[15px] font-rajdhani tracking-[0.1em] placeholder:text-[#666666] focus:outline-none focus:border-primary-pink transition-all duration-200 ease-in-out"
              />
            </div>

            <div className="mb-6">
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm new password"
                aria-label="Confirm new password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-black border border-[#333333] rounded-lg text-white text-[15px] font-rajdhani tracking-[0.1em] placeholder:text-[#666666] focus:outline-none focus:border-primary-pink transition-all duration-200 ease-in-out"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-[#1a1a1a] text-white text-sm font-bold uppercase tracking-widest rounded-sm border border-white/15 cursor-pointer transition-all duration-300 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'RESETTING…' : 'RESET PASSWORD'}
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

export default ResetPasswordScreen;
