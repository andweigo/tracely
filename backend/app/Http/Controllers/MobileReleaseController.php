<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiDomainException;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MobileReleaseController extends Controller
{
    private const APK_RELATIVE_PATH = 'app/public/downloads/tracely.apk';

    private const META_RELATIVE_PATH = 'app/public/downloads/tracely-release.json';

    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    public function showDownloadPage(): View
    {
        $meta = $this->readReleaseMeta();
        $apkExists = is_file($this->apkFullPath());

        return view('mobile-download', [
            'available' => $apkExists,
            'meta' => $meta,
            'downloadUrl' => route('mobile.download.apk'),
            'apiBaseUrl' => rtrim((string) config('app.url'), '/').'/api/v1',
            'webAppUrl' => $this->primaryWebOrigin(),
        ]);
    }

    public function downloadApk(): BinaryFileResponse|JsonResponse
    {
        $path = $this->apkFullPath();
        if (! is_file($path)) {
            return response()->json([
                'code' => 'APK_NOT_PUBLISHED',
                'message' => 'Tracely Android APK has not been published yet.',
            ], 404);
        }

        return response()->download($path, 'tracely.apk', [
            'Content-Type' => 'application/vnd.android.package-archive',
            'Cache-Control' => 'public, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function uploadRelease(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (strtolower((string) $actor->role) !== 'ict_admin') {
            throw new ApiDomainException(
                'FORBIDDEN',
                'Only ICT Administrators can publish mobile APK releases.',
                403,
            );
        }

        $validated = $request->validate([
            'apk' => ['required', 'file', 'max:153600'],
            'version' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string', 'max:300'],
        ]);

        $uploaded = $request->file('apk');
        if (! $uploaded || ! $uploaded->isValid()) {
            throw new ApiDomainException('INVALID_UPLOAD', 'Uploaded APK file is invalid.', 422);
        }

        $originalName = strtolower((string) $uploaded->getClientOriginalName());
        if (! str_ends_with($originalName, '.apk')) {
            throw new ApiDomainException('INVALID_APK_EXTENSION', 'Uploaded file must have a .apk extension.', 422);
        }

        $tmpPath = $uploaded->getRealPath();
        $magic = $tmpPath ? @file_get_contents($tmpPath, false, null, 0, 4) : false;
        if ($magic !== "PK\x03\x04") {
            throw new ApiDomainException('INVALID_APK_ARCHIVE', 'Uploaded file is not a valid Android APK archive.', 422);
        }

        $targetDir = dirname($this->apkFullPath());
        File::ensureDirectoryExists($targetDir, 0775, true);

        $tmpTarget = $this->apkFullPath().'.tmp';
        $uploaded->move($targetDir, basename($tmpTarget));
        @rename($tmpTarget, $this->apkFullPath());
        @chmod($this->apkFullPath(), 0644);

        $sizeBytes = (int) filesize($this->apkFullPath());
        $sha256 = (string) hash_file('sha256', $this->apkFullPath());
        $version = trim((string) ($validated['version'] ?? '1.0.0')) ?: '1.0.0';
        $notes = trim((string) ($validated['notes'] ?? ''));

        $meta = [
            'version' => $version,
            'file_name' => 'tracely.apk',
            'size_bytes' => $sizeBytes,
            'size_mb' => round($sizeBytes / (1024 * 1024), 2),
            'sha256' => $sha256,
            'notes' => $notes,
            'uploaded_at' => now()->toIso8601String(),
            'uploaded_by' => $actor->full_name,
        ];

        file_put_contents(
            $this->metaFullPath(),
            json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
        );

        $this->audit->record(
            $actor,
            'mobile_apk_published',
            null,
            null,
            "Published Tracely Android APK v{$version} ({$meta['size_mb']} MB, sha256:".substr($sha256, 0, 12).')',
            $actor->currentAccessToken()?->name ?? 'Release CLI',
        );

        return response()->json([
            'status' => 'published',
            'download_page_url' => route('mobile.download.page'),
            'apk_url' => route('mobile.download.apk'),
            'release' => $meta,
        ], 201);
    }

    private function apkFullPath(): string
    {
        return storage_path(self::APK_RELATIVE_PATH);
    }

    private function metaFullPath(): string
    {
        return storage_path(self::META_RELATIVE_PATH);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readReleaseMeta(): ?array
    {
        $metaPath = $this->metaFullPath();
        if (is_file($metaPath)) {
            $decoded = json_decode((string) file_get_contents($metaPath), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        $apkPath = $this->apkFullPath();
        if (! is_file($apkPath)) {
            return null;
        }

        $sizeBytes = (int) filesize($apkPath);

        return [
            'version' => '1.0.0',
            'file_name' => 'tracely.apk',
            'size_bytes' => $sizeBytes,
            'size_mb' => round($sizeBytes / (1024 * 1024), 2),
            'sha256' => (string) hash_file('sha256', $apkPath),
            'uploaded_at' => date('c', (int) filemtime($apkPath)),
        ];
    }

    private function primaryWebOrigin(): ?string
    {
        $origins = (array) config('cors.allowed_origins', []);

        foreach ($origins as $origin) {
            $trimmed = trim((string) $origin);
            if (str_starts_with($trimmed, 'https://')) {
                return rtrim($trimmed, '/');
            }
        }

        return null;
    }
}
