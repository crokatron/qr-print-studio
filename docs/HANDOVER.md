# QR Print Studio: maintainer handover

[One-screen summary](START-HERE.md) · [User manual](USER-MANUAL.md) · [Feature overview](../README.md) · [Recorded validation](../VALIDATION.md)

## Purpose and behaviour to preserve

Design readable QR tags and plant labels for 3D printing. Start with a URL or an existing QR image, add names, choose a stake or flat-tag shape, and export printable bodies. The hosted edition can also use the plant collection and batch label workflows. It is a design/export tool; your slicer or label-printer application still prepares and sends the print.

- **QR input:** Generate from a link or decode PNG, JPG, WebP and PDF QR artwork. (Standalone + hosted.)
- **Tag layouts:** Combine QR and names; rotate content and choose a centred stake, left/right flag or flat tag. (Both.)
- **Geometry controls:** Adjust blade, neck and label dimensions and preview the resulting geometry. (Both.)
- **Slotted spikes:** Create two blades that slot together; export a small fit test before the full design. (Both.)
- **Colour-aware exports:** Export 3MF or aligned STL bodies so the slicer can assign materials to the intended regions. (Both.)
- **Plant collection:** Search plants, retain per-plant settings and preview/export selected tags on multiple plates. (Hosted.)
- **Name stickers:** Set actual label-roll dimensions, padding, type size and printer resolution; export PDF or an Excel name batch. (Hosted.)

The [demo](../demo.html) is a smaller, labelled simulation with fictional data. It explains cause and effect without the real service; it is not evidence of a working production installation. Numbered screenshots in the user manual distinguish actual-app captures from demo captures.

## Files and sources of truth

| Actual package path | Maintainer role |
| --- | --- |
| [projects-host/site/qr-studio](../projects-host/site/qr-studio) | Browser UI, geometry and export modules |
| [projects-host/qr-studio-dev](../projects-host/qr-studio-dev) | Dependency manifest, bundler and UI checks |
| [demo-source](../demo-source) | Editable demo HTML/CSS/runtime and embedded screenshot tour |
| [SOURCE-MANIFEST.json](../SOURCE-MANIFEST.json) | Original copied-source paths and SHA-256 checkpoint values |

The original working source is under C:/Users/lamon/Desktop/AI TOOLS/NAS for NAS modules; adjacent CAD/watch source locations are recorded by the full backup’s reviewed source manifest. This package contains only the explicitly copied source, not an automatic mirror. The main private nas-projects backup retains the broader shared host context.

## Setup, run and tests

Run commands from this repository root unless a `cd` is shown. Use a disposable checkout and fictional data for first setup. Dependencies, SDKs, signing material and personal data are not bundled. The following are continuation instructions grounded in the retained source, **not commands executed or newly certified by this handover**.

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

/projects-host/site/qr-studio/

Selected project check:

```powershell
node --check projects-host/site/qr-studio/geometry.js
```

For the documentation demo alone, serve this repository on loopback with `python -m http.server 8765 --bind 127.0.0.1` and open `/demo.html`. Choose a free port if another preview is running. JavaScript syntax can be checked with `node --check demo-source/runtime.js`. `python demo-source/rebuild.py` rewrites demo.html, so run it only in a disposable checkout or an authorised demo-editing session. A local server cannot provide missing HA/CAD/NAS functions. Inspect browser tests for installed dependencies, fixture requirements and network targets before running them with the approved browser tooling.

## Data, configuration and backup boundaries

Keep design JSON, target URL and generated files together. Hosted per-plant catalog/settings require the plant gateway and are not connected in the standalone package. The bundled real QR encoder in demo.html has retained third-party notices.

Standalone settings remain in this browser and can be saved as portable design JSON. Hosted collection settings are saved per plant on the NAS. Keep the editable JSON and the intended URL with your exported print files; STL/3MF output is not a replacement for the editable design.

Git preserves reviewed source and documentation. It does not copy browser storage, application databases, uploaded models/photos, accepted device settings, SDKs or credentials. Maintain independent recovery copies of the data identified above, including matching configuration and asset versions. Never add real secrets to examples, issues or logs. Private source copies on GitHub are not proof of a complete NAS/offsite data backup.

## Current verification and Git state

Before these documentation edits on 14 October 2026, this package was clean on branch `main` at `5205127986415770ed56c93eba6e99e7e5992345` and its private upload was verified. All 31 manifest-listed source entries matched their stored checksums before editing. The upload follow-up has completed all 17 repositories and is paused; it does not run this tool or back up its live data.

These handover pages and README links accompany the private source package. Preserve them when continuing; stage only reviewed changes. Recheck current `git status --short --branch` and `git diff` before starting. No project-specific background schedule was inspected or changed in this documentation pass. Any service schedules in older notes are historical claims to verify in the actual deployment.

Earlier package checks and limits are recorded in [VALIDATION.md](../VALIDATION.md). This handover adds documentation/link/whitespace/secret and source-preservation checks only. No current NAS release, real hardware state, fresh installation, complete data restoration or offsite-backup freshness was verified here.

## Recovery approach

1. Preserve the current installation/data before changing it. Identify the exact code commit and data snapshot required; do not assume this package matches the running service.
2. Recover source into a new folder. Verify the source manifest and restore the project-specific configuration/assets described above separately. Recreate dependencies from the retained project files and guides.
3. Restore user data into an isolated instance or clean test browser. Check a representative editable record, associated files and save/reload behaviour, then compare to the original. Do not test recovery by overwriting production.
4. Record what actually restored and what remains missing. A demo opening or a passing syntax check is not a production recovery drill. Real deployment/device actions need the existing authorised workflow.

## Known limits and next work

A browser preview and valid 3MF archive have been checked. Physical printing, scanning and the full range of printers/materials remain separate checks. The standalone export has no connected plant catalog or NAS batch service.

**Priority:** Print a dimensional fit coupon and scan the actual printed code; test catalog-linked batching separately. When rebuilding the full tool, work in qr-studio-dev, install its recorded dependencies and run node build.mjs; package.json does not define an npm test shortcut.

Common symptoms to check for this tool:

- Unrecognised QR: try a sharper, front-facing source and confirm the decoded link.
- Unreadable print: improve contrast, module size and margins, then test a single tag.
- Wrong print size: import geometry in millimetres; print label PDFs at 100%.
- All plants absent: collection access is intentionally disabled in the standalone edition.

Keep [the release checklist](../RELEASE-CHECKLIST.md) and [third-party notes](../THIRD-PARTY.md) with the package. Original contributions use MIT; bundled/upstream code and assets keep their own licences. Public publication is a separate decision; preparing documentation is not permission to publish.
