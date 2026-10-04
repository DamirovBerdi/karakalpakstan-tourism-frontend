// Intelligent route & component preloader for instant zero-lag page navigation
type ComponentLoader = () => Promise<unknown>;

const routeLoaders: Record<string, ComponentLoader[]> = {
  analytics: [() => import('@/components/TourismAnalytics')],
  stats: [() => import('@/components/TourismAnalytics')],
  stories: [() => import('@/components/heritage/HeritageStories')],
  history: [() => import('@/components/heritage/HeritageStories')],
  tours: [
    () => import('@/components/ToursSection'),
    () => import('@/components/Guides'),
    () => import('@/components/TravelBuddyMatcher'),
  ],
  guides: [() => import('@/components/Guides')],
  visa: [() => import('@/components/VisaAssistance')],
  flights: [() => import('@/components/FlightBooking')],
  taxi: [() => import('@/components/TaxiBooking')],
  transport: [() => import('@/components/Transport')],
  hotels: [() => import('@/components/Hotels')],
  map: [() => import('@/components/GpsMap'), () => import('@/components/InteractiveMap')],
  'interactive-map': [() => import('@/components/InteractiveMap')],
  'gps-map': [() => import('@/components/GpsMap')],
  gps: [() => import('@/components/GpsMap')],
  around: [() => import('@/components/AroundMe')],
  tracker: [() => import('@/components/TripTracker')],
  virtual: [() => import('@/components/heritage/VirtualTour')],
  museums: [() => import('@/components/heritage/Museums')],
  culture: [() => import('@/components/heritage/Culture')],
  cuisine: [() => import('@/components/heritage/Cuisine')],
  aral: [() => import('@/components/aralExperience/AralExperience')],
  'muslim-travel': [() => import('@/components/MuslimTravel')],
  muslim: [() => import('@/components/MuslimTravel')],
  community: [
    () => import('@/components/Community'),
    () => import('@/components/Reviews'),
    () => import('@/components/PhotoContest'),
    () => import('@/components/Leaderboard'),
    () => import('@/components/QrCheckin'),
  ],
  reviews: [() => import('@/components/Reviews')],
  contest: [() => import('@/components/PhotoContest')],
  'photo-contest': [() => import('@/components/PhotoContest')],
  leaderboard: [() => import('@/components/Leaderboard')],
  'qr-checkin': [() => import('@/components/QrCheckin')],
  qr: [() => import('@/components/QrCheckin')],
  budget: [
    () => import('@/components/BudgetPlanner'),
    () => import('@/components/CurrencyConverter'),
  ],
  currency: [() => import('@/components/CurrencyConverter')],
  plan: [
    () => import('@/components/planExplore/PlanExplore'),
    () => import('@/components/Essentials'),
    () => import('@/components/EmergencyKit'),
  ],
  essentials: [() => import('@/components/Essentials')],
  safety: [() => import('@/components/EmergencyKit')],
  minigame: [
    () => import('@/components/MiniGame'),
    () => import('@/components/SurpriseMe'),
  ],
  surprise: [() => import('@/components/SurpriseMe')],
  profile: [() => import('@/components/ProfileDashboard')],
};

const preloadedSet = new Set<string>();

/**
 * Preloads dynamic component chunks for a given route key (e.g. 'tours', '#virtual', etc.)
 * Safely ignores duplicates and network errors.
 */
export function preloadRoute(target: string): void {
  if (!target || typeof target !== 'string') return;
  const clean = target.replace(/^#\/?/, '').toLowerCase().trim();
  if (!clean || clean === 'home' || preloadedSet.has(clean)) return;

  const loaders = routeLoaders[clean];
  if (loaders && loaders.length > 0) {
    preloadedSet.add(clean);
    loaders.forEach((loader) => {
      loader().catch(() => {
        // If fetch fails (e.g. offline), remove from set so it can retry later
        preloadedSet.delete(clean);
      });
    });
  }
}

/**
 * Starts gentle background idle prefetching for the top 3 essential routes.
 * Strictly postponed until AFTER window 'load' + 3.5s idle period to keep initial JS
 * execution, hero image loading, and first paint blistering fast.
 */
export function initBackgroundPreloading(): void {
  if (typeof window === 'undefined') return;

  // Respect user's Data-Saver preferences and avoid mobile 2G network congestion
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (nav?.connection?.saveData === true) return;
  if (nav?.connection?.effectiveType === '2g' || nav?.connection?.effectiveType === 'slow-2g') return;

  const CORE_ROUTES = ['tours', 'aral', 'virtual'];

  const runSchedule = () => {
    CORE_ROUTES.forEach((route, index) => {
      setTimeout(() => {
        preloadRoute(route);
      }, 3500 + index * 2000);
    });
  };

  const scheduleOnIdle = () => {
    if ('requestIdleCallback' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).requestIdleCallback(() => runSchedule(), { timeout: 6000 });
    } else {
      setTimeout(runSchedule, 3500);
    }
  };

  if (document.readyState === 'complete') {
    scheduleOnIdle();
  } else {
    window.addEventListener('load', scheduleOnIdle, { once: true });
  }
}
