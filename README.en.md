# OSCA Viewer for iOS (PWA)

A phone-side browser for OSCA cloud storage (S3-compatible): point it at any S3 endpoint and
browse, upload, download, preview, rename, delete and share.

- **No App Store, no Xcode**: it is a PWA. Open it in Safari and *Add to Home Screen*; the icon and
  standalone window behave like a native app.
- **No backend, no third-party dependencies**: every request goes from the browser straight to S3;
  credentials stay in local `localStorage`.
- Signing is hand-written AWS Signature V4 over WebCrypto, the same logic as the macOS app.

[中文](README.md) · English

## Why not a native app

Building a native iOS app needs Xcode (iOS SDK plus a simulator) and this machine only has the
Command Line Tools, so it cannot be compiled here. The gateway sends
`access-control-allow-origin: *`, so the browser can sign requests itself — which makes a PWA the
one form that works right now, with no signing, no review and no developer account.

## Installing on an iPhone

1. Open `https://lan1081210.github.io/osca-viewer-ios/` in Safari.
2. Tap the share button → **Add to Home Screen**.
3. Open it, tap the gear in the top-left and fill in Endpoint / Bucket / Access Key / Secret Key /
   Region.

## Features

| Feature | Notes |
|---|---|
| Browse | Folder levels, breadcrumbs, sort by name / size / time, filter the current folder |
| Upload | Multi-select files, single PUT each; large files go as a plain body (>100 MB works on this gateway) |
| Download | Hands a presigned URL to the system downloader |
| Preview | Images, video, audio and PDF inline; text types displayed inline |
| Share | Presigned link valid for one hour, copied to the clipboard |
| Rename | copy + delete; folders handled recursively |
| Create / delete | Delete a single object or a whole prefix (recursive, with a second confirmation) |
| Long press | Brings up the action menu (iOS has no right click) |

## Security

- Credentials live in the browser's `localStorage`, visible only on this device and origin. Signing
  out means clearing them in Settings and saving.
- Every request is HTTPS straight to the gateway; no third-party server is involved.
- A share link is a presigned URL — **anyone holding it can download** until it expires. Do not send
  it to people who should not have the file.
- The page itself contains no keys, so the repository can stay public.

## Local development and verification

```bash
cd docs && python3 -m http.server 8080     # open http://localhost:8080
node test/live.test.mjs                    # a real read/write round trip using the rclone credentials
```

`test/live.test.mjs` lists the root, presigns and fetches one object, PUTs a probe, reads it back and
deletes it. It reads credentials from `~/.config/rclone/rclone.conf`, never prints a key and leaves
no temporary files.

## Limits

- No multipart upload (a single PUT is bounded by the gateway; 100 MB-class files are fine).
- No resumable transfers.
- No offline object cache: only the page shell is cached, so the list will not open without a network.
- iOS throttles PWAs in the background — keep long transfers in the foreground.

## Layout

```
docs/               # the static site (GitHub Pages publishes this directory)
  index.html        # UI and interaction
  s3.js             # SigV4 signing + S3 calls (shared by page and tests)
  sw.js             # offline shell cache
  manifest.webmanifest
  icons/
test/live.test.mjs  # real-environment read/write verification
```
