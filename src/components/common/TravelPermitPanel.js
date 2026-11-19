import React, { Suspense, lazy } from 'react';
import { TRAVEL_ENABLED } from '../../utils/travelFlag';

// The panel and its rule data load on demand: nothing ships or fetches while
// the feature is switched off.
const TravelPanel = lazy(() => import('./TravelPanel'));

const TravelPermitPanel = (props) => (TRAVEL_ENABLED ? <Suspense fallback={null}><TravelPanel {...props} /></Suspense> : null);

export default TravelPermitPanel;
