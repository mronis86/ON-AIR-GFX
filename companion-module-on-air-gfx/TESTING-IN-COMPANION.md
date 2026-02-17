# How to see and test this module in Companion 3.2.2

Same approach as the working **Run of Show** module: use a **parent folder** that contains only the module folder (like `ROS-5.0` contains `companion-module-runofshow`).

## Option A – Mirror the ROS-5.0 layout (recommended)

So Companion sees the same structure as for Run of Show:

1. **Create a parent folder** that will hold only this module, e.g.  
   `C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX-COMPANION`

2. **Copy** the entire `companion-module-on-air-gfx` folder into it. You should have:
   ```
   ON-AIR-GFX-COMPANION\
   └── companion-module-on-air-gfx\
       ├── companion\
       │   ├── manifest.json
       │   └── HELP.md
       ├── src\
       │   ├── main.js
       │   ├── actions.js
       │   ├── feedbacks.js
       │   ├── variables.js
       │   └── upgrades.js
       ├── package.json
       └── node_modules\   (after npm install)
   ```

3. **Install dependencies** in the copied module:
   ```bash
   cd C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX-COMPANION\companion-module-on-air-gfx
   npm install
   ```

4. **In Companion 3.2.2** (same as for Run of Show):
   - Open **Advanced Settings** (cog).
   - Turn **Enable Developer Modules** **ON**.
   - **Developer Module Path** → **Select** → choose:  
     **`C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX-COMPANION`**  
     (the parent folder that *contains* `companion-module-on-air-gfx`, not the module folder itself).
   - Close the window, then **fully quit and restart Companion**.

5. **Add connection** → you should see **ON-AIR-GFX** in the list (same way you see Run of Show when the path is `ROS-5.0`).

## Option B – Use the repo folder as parent

If you prefer not to copy, set the Developer Module Path to:

`C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX`

Then Companion will look for subfolders that contain `companion/manifest.json`; it should find `companion-module-on-air-gfx`. If it still doesn’t show up, use Option A.

## Dependencies (if not done)

In the **companion-module-on-air-gfx** folder you’re using:

```bash
cd C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX\companion-module-on-air-gfx
npm install
```

(or the same path under `ON-AIR-GFX-COMPANION` if you used Option A).

## Add the connection

1. In Companion, click **"Launch GUI"** (or open the admin UI).
2. Add a new connection.
3. In the list, look for **ON-AIR-GFX** (you may need to scroll or search).
4. If a built-in module has the same ID, pick the **"dev"** version.
5. Configure **Railway API URL** and **Event ID**, then save.

## 4. If the module still doesn't appear

- **Enable Developer Modules** must be **ON** in Advanced Settings.
- **Path** must be the **parent** folder: `C:\Users\audre\OneDrive\Desktop\ON-AIR-GFX` — **not** `...\companion-module-on-air-gfx`.
- **Restart:** Fully quit and reopen Companion after changing the path or enabling dev modules.
- **node_modules:** Ensure `npm install` was run inside `companion-module-on-air-gfx` and that the `node_modules` folder exists there.
- **Companion log:** Turn on debug/logging in Companion and check for errors when it starts. On Windows, logs are often under `%APPDATA%\companion` or the Companion install directory.
- **OneDrive:** If the path is under OneDrive and you see odd behaviour, try copying `companion-module-on-air-gfx` to a local folder (e.g. `C:\companion-dev\companion-module-on-air-gfx`) and set the Developer Module Path to `C:\companion-dev`.

## Alternative: import as package

1. In `companion-module-on-air-gfx` run: `npm run package` (or `yarn package`). This produces a `.tgz` file (often in `dist/` or the project root).
2. In Companion's admin UI, go to **Modules** (or Settings) and use **"Import module package"** (or equivalent).
3. Select the generated `.tgz` file.

After import, **ON-AIR-GFX** should appear when adding a new connection.
