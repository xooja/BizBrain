# Technical Context

## Technologies
- **Frontend:** Vanilla JS (ES6+), CSS3 with custom properties
- **Backend:** PHP 8.x with PDO
- **Database:** MySQL/MariaDB 10.4+
- **Server:** Apache (XAMPP)
- **Icons:** Font Awesome 6
- **Fonts:** Syne (headings), DM Sans (body)
- **PWA:** Service Worker + Web App Manifest

## Key Dependencies
- No JS frameworks (vanilla JS)
- PHP extensions: PDO, pdo_mysql, bcrypt (password_hash)
- Service Worker for offline caching

## Project Structure
```
BizBrain-Pro/
├── index.html           # Login + app shell
├── database.sql         # Full schema + seed data
├── manifest.json        # PWA manifest
├── sw.js                # Service Worker
├── css/
│   ├── app.css          # Core theme, variables, base
│   ├── forms.css        # Form styles
│   ├── tables.css       # Table styles
│   ├── dashboard.css    # Dashboard layout
│   └── registration.css # Registration wizard styles
├── js/
│   ├── db.js            # IndexedDB wrapper
│   ├── api.js           # HTTP API layer
│   ├── auth.js          # Authentication module
│   ├── sync.js          # Offline sync engine
│   ├── router.js        # SPA router
│   ├── app.js           # Main app controller
│   └── registration.js  # Registration wizard controller
├── pages/
│   └── registration.html # Registration page
├── php/
│   ├── config/
│   │   ├── app.php      # App config & helpers
│   │   └── database.php # DB connection
│   └── api/
│       └── auth/
│           ├── login.php
│           ├── logout.php
│           ├── check.php
│           ├── check-username.php
│           ├── check-email.php
│           └── register.php
└── memory-bank/
    ├── projectbrief.md
    ├── productContext.md
    ├── systemPatterns.md
    ├── techContext.md
    ├── activeContext.md
    └── progress.md