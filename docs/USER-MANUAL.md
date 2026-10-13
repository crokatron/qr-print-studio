# QR Print Studio — visual user manual

[Project overview](../README.md) · [Offline interactive demo](../demo.html)

Start with the numbered picture guide. Each number identifies the exact highlighted control. Work through one step at a time; the longer reference is below it.

### Actual tool · controls at a glance

Actual application screenshot. Numbered boxes point to the controls described below. 

![QR Print Studio — numbered controls](images/guide-1.jpg)

1. **Start with the link.** Paste a URL or import a QR image. Verify its content first.
2. **Name the tag.** Set the visible name, then choose raised lettering, sticker space or QR only.
3. **Inspect the model.** Rotate the live preview and check margins, dimensions and readable QR modules.

### Actual tool · export and save

Actual application screenshot. Numbered boxes point to the controls described below. 

![QR Print Studio — numbered controls](images/guide-2.jpg)

1. **Download the colour model.** Open the 3MF in your slicer and verify material slots.
2. **Know what STL loses.** Combined STL is geometry only; it has no colour assignments.
3. **Keep the editable source.** Save design JSON so you can make a different tag later.

### Try the working offline example

Screenshot of this project’s interactive demo. Side-by-side services are explicitly simulated.

![QR Print Studio — numbered controls](images/guide-3.jpg)

1. **Encode an example link.** This demo uses a real local QR encoder. No link is opened or uploaded.
2. **Update the tag.** Change the name and shape, then rebuild the 2D illustration.
3. **See the result.** The real tool exports 3D files; this demo shows the design idea.

## Detailed task reference

### Make your first QR tag

1. Paste an ordinary demonstration URL into the QR input. If importing artwork, choose a clear image or PDF and verify the decoded link before designing around it.
2. Enter a short readable name; add a scientific name only if useful. Choose a starting layout and tag type.
3. Set overall dimensions, label placement and content rotation. Refresh the preview and check that lettering, QR modules and margins remain distinct.
4. Export a colour 3MF, open it in your slicer and assign the intended filament colours. Verify size and part placement before slicing.
5. Print one test tag and scan the physical result. A successful model export does not demonstrate that your print is optically readable.

### Choose the right shape

1. Use a flat tag for attachment to a surface, a centred stake for a straight insertion point, or a left/right flag when the label needs to sit beside the stake.
2. For slotted spikes, inspect both blades in the assembly preview, then export and print the fit-test STL.
3. Adjust the slot fit based on your printer and material. Only then export the full pair. Keep the two blades as their intended separate parts.

### Batch plant tags — hosted edition

1. Open All plants, refresh the collection and search for the group you want. Select matching plants or individual records.
2. Open a plant’s Tag editor, refine its layout and save that plant’s print settings to NAS. Review the selected nozzle and name treatment.
3. Preview selected tags. Resolve crowded names or unsuitable sizes before exporting the multi-plate 3MF.
4. Open the batch in the slicer and review every plate, including purge-tower and edge clearances. Per-plant settings should not be assumed identical.

### Make name stickers — hosted edition

1. Choose the label-printer mode. Enter the dimensions printed on your roll; length runs along the roll and height across it.
2. Adjust padding and letter size. The D11 layout respects its narrower printable width; text wrapping is preferable to unreadably shrinking every name.
3. Choose PDF when you need to retain the designed dimensions and layout, and print at actual size / 100%.
4. Choose the Excel batch for a printer application’s data import. Bind Plant name to a text field in that application. Excel supplies names; it does not preserve the PDF’s exact layout.
5. Name stickers contain text; the QR remains on the 3D-printed stake. Use the label-dimension option to reserve a matching flat space on the stake.

## Keep your work

Standalone settings remain in this browser and can be saved as portable design JSON. Hosted collection settings are saved per plant on the NAS. Keep the editable JSON and the intended URL with your exported print files; STL/3MF output is not a replacement for the editable design.

## If something looks wrong

- Unrecognised QR: try a sharper, front-facing source and confirm the decoded link.
- Unreadable print: improve contrast, module size and margins, then test a single tag.
- Wrong print size: import geometry in millimetres; print label PDFs at 100%.
- All plants absent: collection access is intentionally disabled in the standalone edition.

## What this manual does not promise

A browser preview and valid 3MF archive have been checked. Physical printing, scanning and the full range of printers/materials remain separate checks. The standalone export has no connected plant catalog or NAS batch service.

Screenshots show the actual application where captured. The offline demo is a deliberately smaller simulation and identifies its dummy services. It never controls devices, sends notifications, uploads files or launches printing.
