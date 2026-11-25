<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Download Tracely Android App</title>
  <link rel="icon" type="image/png" href="{{ asset('images/tracely-logo.png') }}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
    rel="stylesheet"
  />
  <style>
    :root {
      --navy: #0D3472;
      --navy-deep: #09234D;
      --amber: #F3B32A;
      --amber-hover: #E5A41C;
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --border: #E5E7EB;
      --text: #0F172A;
      --muted: #475569;
      --subtle: #64748B;
      --teal-soft: #CCFBF1;
      --teal-text: #115E59;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(160deg, #F8FAFC 0%, #EEF2F8 100%);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 28px 24px;
      box-shadow: 0 20px 50px rgba(9, 35, 77, 0.08);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 20px;
    }
    .brand img {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: #fff;
      object-fit: contain;
      padding: 4px;
    }
    .brand h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: var(--navy-deep);
      letter-spacing: -0.02em;
    }
    .brand p {
      margin: 3px 0 0;
      font-size: 13px;
      color: var(--muted);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--teal-soft);
      color: var(--teal-text);
      font-size: 12px;
      font-weight: 700;
      padding: 5px 11px;
      border-radius: 999px;
      margin-bottom: 16px;
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 15px 20px;
      border-radius: 12px;
      background: var(--navy);
      color: #FFFFFF;
      text-decoration: none;
      font-weight: 700;
      font-size: 15px;
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .cta:hover { background: var(--navy-deep); }
    .cta:active { transform: translateY(1px); }
    .meta {
      margin-top: 18px;
      padding: 14px;
      border-radius: 12px;
      background: var(--bg);
      border: 1px solid var(--border);
      display: grid;
      gap: 8px;
      font-size: 12.5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
    }
    .meta-label { color: var(--subtle); font-weight: 600; flex-shrink: 0; }
    .meta-value {
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      text-align: right;
      word-break: break-all;
    }
    .steps {
      margin: 20px 0 0;
      padding-left: 18px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }
    .steps li { margin-bottom: 6px; }
    .footer-links {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-size: 13px;
    }
    .footer-links a {
      color: var(--navy);
      font-weight: 600;
      text-decoration: none;
    }
    .footer-links a:hover { text-decoration: underline; }
    .unavailable {
      padding: 16px;
      border-radius: 12px;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      color: #92400E;
      font-size: 13.5px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <img src="{{ asset('images/tracely-logo.png') }}" alt="Tracely Logo" />
      <div>
        <h1>Tracely for Android</h1>
        <p>Document Tracking &amp; QR Scanner</p>
      </div>
    </div>

    @if ($available && $meta)
      <a class="cta" href="{{ $downloadUrl }}">
        <span>Download Tracely APK (v{{ $meta['version'] ?? '1.0.0' }})</span>
      </a>

      <div class="meta">
        <div class="meta-row">
          <span class="meta-label">File</span>
          <span class="meta-value">{{ $meta['file_name'] ?? 'tracely.apk' }}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Size</span>
          <span class="meta-value">{{ $meta['size_mb'] ?? '—' }} MB</span>
        </div>
      </div>

      <ol class="steps">
        <li>Tap <strong>Download Tracely APK</strong> above on your Android phone.</li>
        <li>Open the downloaded <code>tracely.apk</code> file. If prompted, enable <strong>Install unknown apps</strong> for your browser.</li>
        <li>Launch <strong>Tracely</strong> and sign in with your account.</li>
      </ol>
    @else
      <div class="unavailable">
        The Android APK build is not published yet. Please check back shortly.
      </div>
    @endif

    @if ($webAppUrl)
      <div class="footer-links">
        <a href="{{ $webAppUrl }}">Open Tracely Web App →</a>
      </div>
    @endif
  </main>
</body>
</html>
