# Atrium Calendar (Static, Public, No-Auth)

This repo builds a single `index.html` page from a Planning Center **ICS** feed and serves it on **GitHub Pages**.  
Use the Pages URL in ProPresenter as a **Web Page** cue. No Google auth, no banners.

## Setup
1. **Add a repo secret** with your ICS link (HTTPS, not webcal):
   - Settings → Secrets and variables → Actions → **New repository secret**
   - Name: `ICS_URL`
   - Value: `https://calendar.planningcenteronline.com/icals/...`

2. **Enable Pages**
   - Settings → Pages → Build and deployment → **Deploy from a branch**
   - Branch: `main` (root)

3. **Trigger a build**
   - Actions tab → run **Build Atrium Calendar**, or wait (runs every 10 minutes).

4. **Use in ProPresenter**
   - Add **Web Page** cue → URL: `https://<your-username>.github.io/<repo-name>/`
   - Resize to right-side column; the page is responsive.

## Tuning
- Change speed in `build.js`: `SCROLL_MS` (e.g., 600000 = 10 minutes).
- Colors are at the top of `build.js` (`COLORS` object).
- Time zone: `TIMEZONE` constant.
