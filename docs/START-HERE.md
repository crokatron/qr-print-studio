# QR Print Studio: start here

**Continuing this tool? Read [the detailed handover](HANDOVER.md).** For pictures and operation, use the [manual](USER-MANUAL.md) and [offline demo](../demo.html).

Printable QR tags and plant labels with shape, size, fitting and export options. A scannable code, an editable design and a printable mesh are different deliverables.

**Start with:** Make your first QR tag. Paste an ordinary demonstration URL into the QR input. If importing artwork, choose a clear image or PDF and verify the decoded link before designing around it.

**Source:** this is a private source checkpoint, not a live-system mirror. Check [the source manifest](../SOURCE-MANIFEST.json) and current working files before merging.

**Keep your work safe:** Standalone settings remain in this browser and can be saved as portable design JSON. Hosted collection settings are saved per plant on the NAS. Keep the editable JSON and the intended URL with your exported print files; STL/3MF output is not a replacement for the editable design.

**Next maintainer action:** Print a dimensional fit coupon and scan the actual printed code; test catalog-linked batching separately. When rebuilding the full tool, work in qr-studio-dev, install its recorded dependencies and run node build.mjs; package.json does not define an npm test shortcut.

**Status:** private upload verified on 14 October 2026. These guides accompany the source package. Live runtime, data backups and full recovery were not retested. Public sharing was authorised on 14 October 2026; the NAS backup remains private.
