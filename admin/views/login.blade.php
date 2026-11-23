@extends('admin::layouts.app')

@section('title', 'Admin Sign In · Tracely')

@section('body')
<style>
  .login-page {
    min-height: 100vh;
    background: var(--surface-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }

  .login-shell {
    width: 100%;
    max-width: 920px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 376px minmax(0, 1fr);
    box-shadow: 0 12px 32px rgba(9, 35, 77, 0.06);
  }

  .login-aside {
    background: var(--navy-deep);
    color: #ffffff;
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 28px;
    position: relative;
  }

  .login-aside-brand {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  .login-aside-name {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
  }

  .login-aside-org {
    margin: 2px 0 0;
    font-size: 12px;
    font-weight: 500;
    color: rgba(226, 232, 240, 0.78);
  }

  .login-aside-lead {
    margin: 24px 0 0;
    font-size: 21px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.3;
    color: #ffffff;
  }

  .login-aside-copy {
    margin: 10px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: rgba(226, 232, 240, 0.78);
  }

  .login-feature-list {
    margin: 24px 0 0;
    padding: 20px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .login-feature-item {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    font-size: 12.5px;
    line-height: 1.45;
    color: rgba(241, 245, 249, 0.9);
  }

  .login-feature-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #F3B32A;
  }

  .login-aside-foot {
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11.5px;
    color: rgba(203, 213, 225, 0.72);
  }

  .login-form-pane {
    padding: 44px 44px 40px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 22px;
  }

  .login-heading {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .login-sub {
    margin: 6px 0 0;
    font-size: 13.5px;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .alert-box {
    padding: 11px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    line-height: 1.45;
  }

  .alert-error {
    background: var(--rose-soft);
    border: 1px solid var(--rose-border);
    color: var(--rose-text);
  }

  .alert-success {
    background: var(--emerald-soft);
    border: 1px solid var(--emerald-border);
    color: var(--emerald-text);
  }

  .input-with-icon {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-with-icon .leading-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    pointer-events: none;
  }

  .input-with-icon .input {
    width: 100%;
    height: 42px;
    padding-left: 38px;
    padding-right: 40px;
    font-size: 14px;
  }

  .pwd-toggle {
    position: absolute;
    right: 8px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    width: 30px;
    height: 30px;
    border-radius: 7px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .pwd-toggle:hover {
    background: var(--surface-soft);
    color: var(--text-primary);
  }

  .login-submit-btn {
    width: 100%;
    height: 44px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
  }

  .login-footnote {
    padding-top: 14px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
  }

  @media (max-width: 820px) {
    .login-shell {
      grid-template-columns: 1fr;
      max-width: 460px;
    }
    .login-aside {
      padding: 24px 22px;
      gap: 16px;
    }
    .login-aside-lead {
      margin-top: 16px;
      font-size: 18px;
    }
    .login-feature-list {
      display: none;
    }
    .login-form-pane {
      padding: 26px 22px;
    }
  }

  @media (max-width: 480px) {
    .login-page {
      padding: 12px;
      align-items: flex-start;
    }
    .login-shell {
      border-radius: 16px;
    }
    .login-aside {
      padding: 20px 18px;
    }
    .login-form-pane {
      padding: 22px 18px;
      gap: 18px;
    }
    .login-heading {
      font-size: 19px;
    }
  }
</style>

<div class="login-page">
  <div class="login-shell" data-testid="admin-blade-login-card">
    <!-- Left Brand Panel (Tracely Navy) -->
    <aside class="login-aside">
      <div>
        <div class="login-aside-brand">
          <img
            src="{{ asset('images/tracely-logo.png') }}"
            alt="Tracely logo"
            class="brand-logo-lg"
            width="46"
            height="46"
          />
          <div>
            <p class="login-aside-name">Tracely Admin</p>
            <p class="login-aside-org">Document Governance Portal</p>
          </div>
        </div>

        <h1 class="login-aside-lead">Document Custody &amp; Governance Portal</h1>
        <p class="login-aside-copy">
          Central administrative workspace for verifying team accounts, maintaining organizational offices,
          monitoring SLA bottlenecks, and auditing custody records.
        </p>

        <ul class="login-feature-list">
          <li class="login-feature-item">
            <span class="login-feature-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
              </svg>
            </span>
            <span>Verify staff registrations, provision verified accounts, and manage unit roles.</span>
          </li>
          <li class="login-feature-item">
            <span class="login-feature-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/>
              </svg>
            </span>
            <span>Track per-office document load, SLA risks, and global document categories.</span>
          </li>
          <li class="login-feature-item">
            <span class="login-feature-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>
              </svg>
            </span>
            <span>Export immutable custody and security audit trails anytime.</span>
          </li>
        </ul>
      </div>

      <div class="login-aside-foot">
        <span>Encrypted Custody &amp; Audit</span>
        <span class="mono">Web-Only Console</span>
      </div>
    </aside>

    <!-- Right Clean White Sign-In Panel -->
    <main class="login-form-pane">
      <div>
        <h2 class="login-heading">Sign in to Admin Portal</h2>
        <p class="login-sub">
          Enter your authorized System Admin, Records Officer, or Executive / HR Unit Head credentials.
        </p>
      </div>

      @if (session('admin_toast'))
        <div class="alert-box alert-success" role="status">
          <span>{{ session('admin_toast') }}</span>
        </div>
      @endif

      @if ($errors->any())
        <div class="alert-box alert-error" role="alert">
          <span>{{ $errors->first() }}</span>
        </div>
      @endif

      <form method="POST" action="{{ route('admin.login.submit') }}" style="display: flex; flex-direction: column; gap: 16px;">
        @csrf

        <div class="field-group">
          <label class="field-label" for="admin-identifier">Employee ID or Work Email</label>
          <div class="input-with-icon">
            <svg class="leading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <input
              id="admin-identifier"
              name="identifier"
              type="text"
              class="input"
              value="{{ old('identifier') }}"
              placeholder="ict@tracely.app or TRC-0801"
              autocomplete="username"
              required
              autofocus
            />
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="admin-password">Password</label>
          <div class="input-with-icon">
            <svg class="leading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <input
              id="admin-password"
              name="password"
              type="password"
              class="input"
              placeholder="Enter administrator password"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="pwd-toggle"
              id="toggle-pwd-btn"
              aria-label="Toggle password visibility"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary login-submit-btn">
          Sign In
        </button>
      </form>

      <div class="login-footnote">
        Sessions are isolated from regular staff web and mobile logins. Unauthorized access attempts
        are logged under Tracely security &amp; data privacy policies.
      </div>
    </main>
  </div>
</div>

<script>
  (function () {
    var btn = document.getElementById('toggle-pwd-btn');
    var input = document.getElementById('admin-password');
    if (btn && input) {
      btn.addEventListener('click', function () {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }
  })();
</script>
@endsection
