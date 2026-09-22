# Lightroom Productions V19

Marketplace-style booking + ecommerce redesign for Lightroom Productions.

## V19 visual direction
- Clean white / light-grey marketplace interface
- Red/pink accent for actions, offers and booking CTAs
- Prominent search and compact category navigation
- Offer Zone on homepage
- Quick category rail for booking and shopping
- Service cards for Wedding, Pre-Wedding, Engagement, Birthday, Rice Ceremony, Corporate, Music Video, Frames, Albums and Printing
- Responsive mobile menu and bottom navigation

The visual language is inspired by common Indian marketplace UX patterns, while using Lightroom Productions' own branding and content rather than copying another site's branding/assets.

## Booking + ecommerce
- Wedding, Pre-Wedding, Engagement, Birthday, Rice Ceremony, Baby, Maternity, Fashion, Corporate, Musical and Music Video packages are available through the booking flow.
- Vowshot products continue through the ecommerce cart/checkout flow.
- Existing Razorpay/Supabase API files were not intentionally modified by the V19 theme pass.

## V20 Facebook portfolio integration
The homepage now has a server-side Wedding Capital Facebook photo feed hook at `/api/facebook-photos`.

For the live Facebook feed, add these Vercel Environment Variables (Production + Preview if desired):
- `FACEBOOK_PAGE_USERNAME=weddingcapital`
- `FACEBOOK_PAGE_ACCESS_TOKEN=<your secure Page access token>`
- `FACEBOOK_GRAPH_VERSION=v26.0` (optional; the API defaults to v26.0)

The access token is never sent to the browser. Without the token, the homepage gracefully falls back to the currently published Wedding Capital portfolio images rather than showing a broken Facebook box.
