# Tracely · Admin Governance Portal (Laravel Blade)

This standalone `c:\docstrack\admin` folder houses the web-only **Tracely Admin Portal** built with **Laravel Blade templates** and designed directly from the Tracely Web (`c:\docstrack\web`) and Mobile (`c:\docstrack\mobile`) design system (`#FFFFFF` / `#F8FAFC` surfaces, `1px` `#E5E7EB` hairlines, Tracely Navy `#0D3472`, restrained Amber `#F3B32A` and Teal `#0F766E` accents, `Inter` + `JetBrains Mono`).

It is completely separated from the end-user React web app (`c:\docstrack\web`) and React Native mobile app (`c:\docstrack\mobile`), and uses its own dedicated web-only session login.

## Folder Structure

- `c:\docstrack\admin\views\layouts\app.blade.php` — Master Tracely layout, sidebar shell, data tables, modal system, and design tokens
- `c:\docstrack\admin\views\login.blade.php` — Separate, dedicated Admin Portal Login page (`GET /admin/login`, `POST /admin/login`)
- `c:\docstrack\admin\views\studio.blade.php` — Admin Governance Workspace (`GET /admin`)

## How to Access

1. Ensure the Laravel backend is running (`php artisan serve` on port `8000`):
   - **Separate Admin Login URL:** `http://127.0.0.1:8000/admin/login`
   - **Admin Dashboard URL:** `http://127.0.0.1:8000/admin`
2. Sign in with any authorized Tracely Administrator account:
   - **System Admin (ICT):** `ict@tracely.app` (or `TRC-0801`) / `Tracely@2026!`
   - **Records Officer:** `records@tracely.app` (or `TRC-0101`) / `Tracely@2026!`
   - **HR Unit Head:** `hr@tracely.app` (or `TRC-0419`) / `Tracely@2026!`
   - **Executive Director:** `exec@tracely.app` (or `TRC-0001`) / `Tracely@2026!`
