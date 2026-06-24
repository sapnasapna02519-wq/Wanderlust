# WanderLust

WanderLust is a full stack web application where users can explore travel listings, manage favorites, and book stays through a clean booking workflow.

## Overview

WanderLust is built as a production-style travel accommodation platform using Node.js, Express, MongoDB, and EJS. It supports user authentication, property management, reviews, favorites, booking checkout, and host-side booking insights.

The project follows an MVC-style structure with separate `routes`, `controllers`, `models`, and `views` for better scalability and maintainability.

## Problem Statement

Travel listing and booking workflows are often scattered and difficult to manage for both guests and hosts. This project solves that by providing:
- a single platform to browse and view listings,
- structured booking and payment flow,
- favorites/wishlist support,
- host dashboard for booking visibility,
- account and password reset flows.

## Tools and Technologies

- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- Frontend Templating: EJS, EJS-Mate
- Styling: CSS (public assets)
- File Uploads: Multer, Cloudinary, multer-storage-cloudinary
- Email: Nodemailer
- Utility: method-override, dotenv

## Features

- Home page with listing discovery
- Listing details with reviews
- User authentication (signup/login/logout)
- Google OAuth route support
- Favorites page
- Booking creation, checkout, cancellation
- Host dashboard with booking and revenue metrics
- Password reset flow via email
- Booking calendar for hosts

## Live Demo
- **Live Project**: https://wanderlust-4-aw25.onrender.com/
- **GitHub Repository**: https://github.com/sapnasapna02519-wq/Wanderlust

## How to Run This Project

### 1) Clone the repository
```bash
git clone https://github.com/sapnasapna02519-wq/Wanderlust.git
cd Wanderlust
```

### 2) Install dependencies
```bash
npm install
```

### 3) Configure environment variables
Create `.env` from `.env.example` and set values:
- `PORT`
- `MONGO_URL`
- `APP_BASE_URL`
- SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- Cloudinary credentials (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`)
- Optional OAuth and payment variables

### 4) Start the app
```bash
npm run dev
```

### 5) Open in browser
```text
http://localhost:8080
```

## Future Work
- Integrate real payment provider (Stripe/Razorpay full flow)
- Add advanced search and filtering
- Improve role-based access controls
- Add automated tests (unit/integration)
- Add API documentation and better analytics
- Improve performance and caching for listing queries

## Author and Contact
Author: Sapna

- GitHub: https://github.com/sapnasapna02519-wq
- LinkedIn: https://www.linkedin.com/in/sapna-gangwar-47b203299