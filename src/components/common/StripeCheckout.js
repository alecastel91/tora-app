import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, AddressElement, useStripe, useElements } from '@stripe/react-stripe-js';
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

import { formatMoney } from '../../utils/money';

// Launch-promo banner shown when Stripe applied a coupon (founding members now,
// the H1-2027 25%-off in that window). Surfaces the discount + first charge.
const PromoBanner = ({ coupon, amountDue, currency, t }) => {
  if (!coupon) return null;
  return (
    <div className="checkout-promo">
      <span className="checkout-promo-badge">
        {t('premium.promoOff', { percent: coupon.percentOff })}
      </span>
      <span className="checkout-promo-due">
        {amountDue != null
          ? t('premium.promoDueToday', { due: formatMoney(amountDue, currency) })
          : coupon.name}
      </span>
    </div>
  );
};

// Billing-address step — shown only when the backend answers ADDRESS_REQUIRED
// (Stripe Tax is on and the customer has no saved address). Stripe's own
// AddressElement handles countries/ISO codes/autocomplete; we pass the result
// back so the subscribe call can be retried with it.
const AddressStep = ({ onContinue, t }) => {
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!elements || busy) return;
    setBusy(true);
    const { complete, value } = await elements.getElement(AddressElement).getValue();
    if (!complete) { setBusy(false); return; } // element shows its own field errors
    onContinue(value.address); // { country (ISO-2), postal_code, city, line1, state }
  };

  return (
    <form onSubmit={submit}>
      <p className="m-0 mb-3 text-sm text-white/70">{t('premium.billingAddress')}</p>
      <AddressElement options={{ mode: 'billing' }} />
      <button type="submit" className="btn btn-primary btn-full mt-5" disabled={busy}>
        {busy ? t('premium.processing') : t('premium.billingAddressContinue')}
      </button>
    </form>
  );
};

// Inner form — needs the <Elements> context around it.
const PaymentForm = ({ mode, subscriptionId, paymentIntentId, profileId, coupon, amountDue, currency, cta, onSuccess }) => {
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
    let confirmError;
    try {
      ({ error: confirmError } = await confirm({
        elements,
        redirect: 'if_required', // stay in-app unless the bank forces a redirect for SCA
        confirmParams: { return_url: window.location.origin },
      }));
    } catch (e) {
      // Stripe throws (rather than resolving with `error`) when the Payment
      // Element never mounted — e.g. the publishable key belongs to a
      // different Stripe account than the backend's secret key. Without this
      // the button sat on "Processing…" forever.
      confirmError = e;
    }

    if (confirmError) {
      setError(confirmError.message || t('premium.paymentFailed'));
      setBusy(false);
      return;
    }
    // Payment/setup succeeded — flip the tier now (don't wait on the webhook).
    // For plan changes, paymentIntentId tells the backend to execute the
    // pending subscription update the payment just covered.
    try {
      await apiService.refreshSubscription({ profileId, subscriptionId, paymentIntentId });
    } catch { /* webhook will reconcile */ }
    onSuccess();
  };

  return (
    <form onSubmit={submit}>
      <PromoBanner coupon={coupon} amountDue={amountDue} currency={currency} t={t} />
      <PaymentElement
        options={{ layout: 'tabs' }}
        // The element failing to load (key/account mismatch, network) is
        // otherwise silent: the form renders empty and Subscribe never works.
        onLoadError={(ev) => setError(ev?.error?.message || t('premium.notConfigured'))}
      />
      {error && <p className="m-0 mt-3 text-sm text-infrared">{error}</p>}
      <button type="submit" className="btn btn-primary btn-full mt-5" disabled={!stripe || busy}>
        {busy ? t('premium.processing') : (cta || t('premium.subscribeNow'))}
      </button>
    </form>
  );
};

/**
 * Embedded subscription checkout. On mount it creates the subscription and
 * mounts the Payment Element with the returned client secret.
 */
const StripeCheckout = ({ profileId, interval, seats, extraItem, onSuccess, onQuote }) => {
  const { t } = useLanguage();
  const [state, setState] = useState({ loading: true });
  const successFired = useRef(false);
  // Each start call creates a REAL Stripe object (subscription or
  // PaymentIntent). Guard by parameter tuple so re-renders, StrictMode's
  // double-invoke, or a language switch can't create duplicates/orphans.
  const startedKeyRef = useRef(null);

  const startKey = `${profileId}|${interval}|${seats}|${extraItem}`;
  useEffect(() => {
    if (!stripePromise) { setState({ error: t('premium.notConfigured') }); return undefined; }
    // Deliberately NO cancelled flag: under StrictMode the effect runs, is
    // "unmounted", then re-runs — the guard skips the second run, so the FIRST
    // run's response must be allowed to land or the checkout hangs on Loading.
    // setState after a real unmount is a safe no-op in React 18.
    if (startedKeyRef.current === startKey) return undefined;
    startedKeyRef.current = startKey;
    begin();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);

  // Two flavours share one embedded flow: subscriptions/plan changes, and
  // one-off extras (+likes / +connections / +offers). With Stripe Tax on, the
  // backend rejects a first-time subscribe with ADDRESS_REQUIRED — we show the
  // address step and re-run with the collected address.
  const begin = (billingAddress) => {
    const start = extraItem
      ? apiService.purchaseExtra({ profileId, item: extraItem })
      : apiService.startSubscription({ profileId, interval, seats, billingAddress });
    start
      .then((res) => {
        setState({ ...res });
        // Report the real charge (prorated on plan changes, discounted under a
        // coupon) so the order summary can show "Due today".
        if (onQuote) onQuote({ amountDue: res.amountDue ?? null, currency: res.currency || null, change: !!res.change, coupon: !!res.coupon });
      })
      .catch((e) => {
        if (e.response?.data?.code === 'ADDRESS_REQUIRED') {
          setState({ addressRequired: true });
          return;
        }
        startedKeyRef.current = null; // allow a retry after a failure
        setState({ error: e.message || t('premium.paymentFailed') });
      });
  };

  // Plan change charged to the card on file (no new card entry needed) — the
  // backend already applied the new tier; just finish the flow.
  useEffect(() => {
    if (!successFired.current && state.mode === 'none' && !state.clientSecret && !state.error) {
      successFired.current = true;
      onSuccess();
    }
  }, [state, onSuccess]);

  const options = useMemo(
    () => (state.clientSecret ? { clientSecret: state.clientSecret, appearance } : null),
    [state.clientSecret]
  );

  if (state.loading) return <p className="py-6 text-center text-sm text-white/50">{t('common.loading')}</p>;
  if (state.error) return <p className="py-6 text-center text-sm text-infrared">{state.error}</p>;
  if (state.addressRequired) {
    return (
      <Elements stripe={stripePromise} options={{ appearance }}>
        <AddressStep
          t={t}
          onContinue={(address) => { setState({ loading: true }); begin(address); }}
        />
      </Elements>
    );
  }
  if (state.mode === 'none') return <p className="py-6 text-center text-sm text-white/50">{t('premium.processing')}</p>;
  if (!options) return <p className="py-6 text-center text-sm text-white/50">{t('premium.notConfigured')}</p>;

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        mode={state.mode}
        subscriptionId={state.subscriptionId}
        paymentIntentId={state.paymentIntentId}
        profileId={profileId}
        coupon={state.coupon}
        amountDue={state.amountDue}
        currency={state.currency}
        cta={extraItem && state.amountDue != null ? t('premium.payNow', { price: formatMoney(state.amountDue, state.currency) }) : undefined}
        onSuccess={onSuccess}
      />
    </Elements>
  );
};

export default StripeCheckout;
