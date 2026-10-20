// Ads stub. v1 ships with no real ads; the UI calls these so a real SDK
// (AdMob via Capacitor) can be dropped in later without touching screens.
export async function showRewarded(placement = 'default') {
  return { shown: false, rewarded: false, placement };
}

export async function showInterstitial(placement = 'default') {
  return { shown: false, placement };
}
