import React from 'react';
import { motion } from 'framer-motion';

const AuthScreenShell = ({ subtitle, children }) => (
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
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  </motion.div>
);

export default AuthScreenShell;
