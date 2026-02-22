## Project Summary
PayLite UPI is a mobile app for offline-assisted UPI payments in India. Users scan Bharat UPI QR codes (offline), enter amounts, choose USSD (*99#) or IVR payment methods, and receive step-by-step instructions to complete the payment through their bank. No UPI PIN is collected in-app.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54), Expo Router, NativeWind (Tailwind CSS), TypeScript
- **Backend**: Hono on Bun (port 3002)
- **State**: useSyncExternalStore-based payment store, React Query for server state
- **Icons**: lucide-react-native
- **Validation**: Zod (backend)

## Architecture
- `frontend/app/` - Expo Router screens: index (home), scan, amount, review, confirm, status
- `frontend/lib/` - Shared utilities: upi.ts (QR parsing), payment-store.ts (global state), api.ts (fetch wrapper), theme.ts
- `backend/src/index.ts` - Hono API with in-memory transaction store
- Payment flow: Home → Scan QR → (Amount if missing) → Review → Confirm → Status polling

## User Preferences

## Project Guidelines
- No comments in code unless requested
- Use NativeWind classes for all styling
- Mobile-first design (349x721px target)

## Common Patterns
- Safe area insets via `useSafeAreaInsets()` on all screens
- Theme-aware icon colors via `useColorScheme()`
- Platform-specific fallbacks (web vs native) for camera, alerts, clipboard
