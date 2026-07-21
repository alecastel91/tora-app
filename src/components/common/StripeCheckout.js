import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

// One Stripe instance for the whole app. Publishable key is public by design;
// it's injected at build time (VITE_STRIPE_PUBLISHABLE_KEY).
const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;

// TORA-dark Payment Element theme.
const appearance = {
  theme: 'night',
  variables: {
    colorPrimary: '#ff3366',
    colorBackground: '#0c0c11',
    colorText: '#f3f2f5',
    colorTextSecondary: '#86858f',
    colorDanger: '#ff3b5c',
    borderRadius: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
};

// Inner form — needs the <Elements> context around it.
const PaymentForm = ({ mode, subscriptionId, profileId, onSuccess }) => {
  const { t } = useLanguage();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError('');

    const confirm = mode === 'setup' ? stripe.confirmSetup : stripe.confirmPayment;
    const { error: confirmError } = await confirm({
      elements,
      redirect: 'if_required', // stay in-app unless the bank forces a redirect for SCA
      confirmParams: { return_url: window.location.origin },
    });

    if (confirmError) {
      setError(confirmError.message || t('premium.paymentFailed'));
      setBusy(false);
      return;
    }
    // Payment/setup succeeded — flip the tier now (don't wait on the webhook).
    try {
      await apiService.refreshSubscription({ profileId, subscriptionId });
    } catch { /* webhook will reconcile */ }
    onSuccess();
  };

  return (
    <form onSubmit={submit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="m-0 mt-3 text-sm text-infrared">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full mt-5" disabled={!stripe || busy}>
        {busy ? t('premium.processing') : t('premium.subscribeNow')}
      </button>
    </form>
  );
};

/**
 * Embedded subscription checkout. On mount it creates the subscription and
 * mounts the Payment Element with the returned client secret.
 */
const StripeCheckout = ({ profileId, interval, onSuccess }) => {
  const { t } = useLanguage();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    if (!stripePromise) { setState({ error: t('premium.notConfigured') }); return undefined; }
    apiService.startSubscription({ profileId, interval })
      .then((res) => { if (!cancelled) setState({ ...res }); })
      .catch((e) => { if (!cancelled) setState({ error: e.message || t('premium.paymentFailed') }); });
    return () => { cancelled = true; };
  }, [profileId, interval, t]);

  const options = useMemo(
    () => (state.clientSecret ? { clientSecret: state.clientSecret, appearance } : null),
    [state.clientSecret]
  );

  if (state.loading) return <p className="py-6 text-center text-sm text-white/50">{t('common.loading')}</p>;
  if (state.error) return <p className="py-6 text-center text-sm text-infrared">{state.error}</p>;
  if (!options) return <p className="py-6 text-center text-sm text-white/50">{t('premium.notConfigured')}</p>;

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm mode={state.mode} subscriptionId={state.subscriptionId} profileId={profileId} onSuccess={onSuccess} />
    </Elements>
  );
};

export default StripeCheckout;
