# Lightroom Productions V21

Marketplace-style homepage inspired by common Indian value-commerce UX patterns, using Lightroom's own branding/content.

## Homepage
- Red / white / light-grey marketplace palette
- Top categories rail
- Left-side All Services navigation
- Wide rectangular hero banner (single photography banner, not full-page photo mosaic)
- Rotating Wedding Capital banner images
- Right-side offer cards
- Offer Zone
- Shop by Occasion
- Vowshot product shelf
- Small Wedding Capital portfolio strip
- Mobile-responsive marketplace layout

## Wedding Capital Facebook feed
The existing server-side endpoint `api/facebook-photos.js` is retained. Configure these Vercel environment variables:

- `FACEBOOK_PAGE_USERNAME=weddingcapital`
- `FACEBOOK_PAGE_ACCESS_TOKEN=<Page access token>`
- `FACEBOOK_GRAPH_VERSION=v26.0`

The access token is server-side only. The homepage should use the Facebook feed when configured and the public WeddingWire image URLs as visual fallback.

## Backend safety
Existing Razorpay/Supabase booking/payment API files were not changed by the V21 homepage redesign.
