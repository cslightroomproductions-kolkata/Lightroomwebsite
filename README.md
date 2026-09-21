# Lightroom Productions — V15 Black & Gold

V15 keeps the V13 marketplace-style usability and V9/V11 commerce flows while applying a unified black + champagne-gold visual identity inspired by Lightroom Productions, Wedding Capital, TinyToons and Vowshot branding.

## Included
- Black + gold brand palette across header, navigation, shelves, products, packages, checkout and footer
- High-contrast ivory typography for readability
- Champagne-gold primary CTAs
- Existing sub-brand logos
- Existing product catalogue excluding photography packages
- Existing Book Now / Check Date wedding flow
- Existing Buy Now / Add to Cart product flow
- Responsive mobile marketplace UX

## Payment
The static build remains payment-ready but must be connected to a secure server-side Razorpay integration before accepting real payments. Never put the Razorpay secret key in client-side JavaScript.


V16: Replaced the main Lightroom Productions logo with the user-supplied white logo and tuned the marketplace header/footer for black + gold contrast.


## Razorpay test integration added
- Vercel serverless `/api/create-order.js` creates Razorpay orders server-side.
- `/api/verify-payment.js` verifies the Razorpay signature.
- Checkout sends product handle/variant to the server so the server calculates the amount from `assets/products.json`.
- Requires Vercel environment variables `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
