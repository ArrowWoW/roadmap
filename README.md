# Metcor Marketing Roadmap

This repository contains a static web application for managing the Metcor marketing roadmap.

## Previewing the site locally

From the project root, start a simple HTTP server and open the site in your browser:

```bash
cd roadmap
python -m http.server 8000
```

Then visit http://localhost:8000 to interact with the application.

## Project structure

The web assets live in the `roadmap/` directory:

- `index.html` – main HTML entry point.
- `css/` – global styles and theme variables.
- `js/` – application logic, including IndexedDB storage and UI rendering.
- `data/` – seed data for first-time initialization.
- `assets/` – static images and icons.

## Browser compatibility

The app targets modern browsers with IndexedDB support. When IndexedDB is unavailable, it automatically falls back to `localStorage`, allowing basic usage without persistent binary file storage.
