# RevenueCat — integrated (juin 2026)
This file is supposed to serve as a memory to you if you have to interact with user's RevenueCat account via integration proxy at any later point in time.

## Identifiers (from /setup response — copy verbatim)
- rc_project_id: projfb23fe8b
- apple_app_id: appe1c9e07bf6
- play_app_id: app471dcda37f
- entitlement_lookup_key: pro
- offering_lookup_key: default
- Packages (package -> product_id, current price):
  - $rc_monthly -> prod5823749452   (€3.99 / P1M, trial: none)
  - $rc_annual  -> prod3768d3c975   (€39.99 / P1Y, trial: none)
- Dashboard: https://app.revenuecat.com/projects/projfb23fe8b
- bundle_id / package_name: com.manent.app (mis à jour via /setup idempotent, juin 2026 — clés SDK inchangées)

## Check for project_state in revenuecat status api response. if the project_state is less then project_created, re-fetch RevenueCat playbook via the integration expert tool.
Status check:
`curl -sS -H "$AUTH" "$INTEGRATION_PROXY_URL/internal/revenuecat/projects/d6281d32-2333-4b80-b67d-5cea45bad9c4/status"`
→ `{"connection_state":"connected","project_state":"...","rc_project_id":"..."}`
(AUTH = the Emergent bearer key from the playbook; never store it here.)

## Later updates to user's products (integration proxy apis ONLY — NEVER call the RevenueCat REST API)
- Change price/duration/trial OR add a package (upsert):
  POST $INTEGRATION_PROXY_URL/internal/revenuecat/projects/d6281d32-2333-4b80-b67d-5cea45bad9c4/products
  body: {"products":[{"package":"$rc_monthly","price":14.99,"currency":"EUR",
         "period":"P1M","trial":"P1W",
         "prices":[{"amount_micros":14990000,"currency":"EUR"}]}]}
  (amount_micros = price × 1,000,000; omit "trial" for none)
- Remove a package:
  DELETE $INTEGRATION_PROXY_URL/internal/revenuecat/projects/d6281d32-2333-4b80-b67d-5cea45bad9c4/products/%24rc_monthly
  ($ -> %24)
- Recover identifiers / repopulate .env: re-run the idempotent /setup call.

## App wiring (frontend)
- Keys in /app/frontend/.env: EXPO_PUBLIC_REVENUECAT_TEST_API_KEY / _IOS_API_KEY / _ANDROID_API_KEY
- lib: /app/frontend/src/revenuecat.tsx (SubscriptionProvider + useSubscription), init at module scope in app/_layout.tsx
- Identity: Purchases.logIn(user.user_id) wired in src/auth.tsx effect; logOut on sign-out
- Paywall: app/premium.tsx (coded paywall, packages from offerings, Restore button)
- Backend mirror: after verified entitlement, frontend calls POST /api/premium/activate to sync capture-quota flag (source of truth reste RevenueCat côté client)

## Taking in-app purchases LIVE — store-side steps (USER does these — agent cannot verify or perform)
Needed ONLY for REAL purchases in published store builds. Test Store
(Expo Go / web preview / dev build) needs none of this.
- Step 1 — Upload App Store / Play Store credentials to the RevenueCat dashboard
  (Home → project → Apps → App name)
  - iOS: In-app purchase key + App Store Connect API key
    https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/in-app-purchase-key-configuration
    https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret/app-store-connect-api-key-configuration
  - Android: Google Play service-account credentials JSON
    https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials
- Step 2 — Payment profiles in App Store Connect / Play Console
- Step 3 — Create matching IAP products with the SAME product IDs as in the RevenueCat dashboard
- Step 4 — Release build → TestFlight / internal testing → store review

All the steps needed to integrate RevenueCat in their production app are present in FAQ section of payments panel.
