<?php

use App\Http\Controllers\Api\V1\AnalyticsController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DirectoryController;
use App\Http\Controllers\Api\V1\DocumentController;
use App\Http\Controllers\Api\V1\QrController;
use App\Http\Controllers\Api\V1\RealtimeController;
use App\Http\Controllers\Api\V1\RoutingTemplateController;
use App\Http\Controllers\MobileReleaseController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'status' => 'ok',
            'database' => DB::getDefaultConnection(),
            'version' => '1.0',
        ]);
    });

    Route::get('/mobile-release/latest', [MobileReleaseController::class, 'latestRelease'])
        ->middleware('throttle:mobile-download-page');

    Route::get('/system/status', function () {
        return response()->json([
            'data' => \App\Models\SystemSetting::allGovernanceSettings(),
        ]);
    });

    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:auth-login');
    Route::post('/auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:auth-register');
    Route::get('/auth/registration-status/{token}', [AuthController::class, 'registrationStatus'])
        ->middleware('throttle:auth-registration-status');
    Route::post('/auth/forgot-password', [AuthController::class, 'requestPasswordReset'])
        ->middleware('throttle:auth-password-reset');
    Route::post('/auth/reset-password', [AuthController::class, 'confirmPasswordReset'])
        ->middleware('throttle:auth-password-reset');
    Route::post('/qr/verify-transmittal', [QrController::class, 'verifyTransmittal'])
        ->middleware('throttle:qr-verify');
    Route::get('/qr/verify/{token}', [QrController::class, 'verifyTransmittal'])
        ->middleware('throttle:qr-verify');
    Route::get('/documents/{id}/versions/{versionNumber}/stream', [DocumentController::class, 'streamVersion'])
        ->name('api.v1.documents.stream');
    Route::get('/documents/{id}/transactions/{transactionId}/proof-stream', [DocumentController::class, 'streamProofPhoto'])
        ->name('api.v1.documents.proof-stream');

    Route::middleware(['auth:sanctum', 'throttle:api-global'])->group(function (): void {
        // Authentication, profile & active sessions
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::patch('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::patch('/auth/preferences', [AuthController::class, 'updatePreferences']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/sessions', [AuthController::class, 'sessions']);
        Route::post('/auth/sessions/revoke-others', [AuthController::class, 'revokeOthers']);
        Route::post('/auth/password', [AuthController::class, 'changePassword']);
        Route::patch('/personnel/availability', [AuthController::class, 'updateAvailability']);
        Route::patch('/auth/availability', [AuthController::class, 'updateAvailability']);

        // ICT / HR / Records pending account approval & office/personnel management console
        Route::get('/admin/pending-users', [AuthController::class, 'pendingUsers']);
        Route::post('/admin/users/{id}/approve', [AuthController::class, 'approveUser']);
        Route::post('/admin/users/{id}/reject', [AuthController::class, 'rejectUser']);
        Route::get('/admin/users', [AuthController::class, 'adminUsers']);
        Route::post('/admin/users', [AuthController::class, 'adminCreateUser']);
        Route::patch('/admin/users/{id}', [AuthController::class, 'adminUpdateUser']);
        Route::post('/admin/offices', [AuthController::class, 'adminCreateOffice']);
        Route::patch('/admin/offices/{id}', [AuthController::class, 'adminUpdateOffice']);
        Route::patch('/admin/categories/{id}', [DirectoryController::class, 'adminUpdateCategory']);
        Route::delete('/admin/categories/{id}', [DirectoryController::class, 'adminDeleteCategory']);
        Route::post('/admin/mobile-release', [MobileReleaseController::class, 'uploadRelease']);

        // Real-time workspace pulse, SSE stream & push device token registration
        Route::get('/events/pulse', [RealtimeController::class, 'pulse']);
        Route::get('/events/stream', [RealtimeController::class, 'stream'])
            ->middleware('throttle:realtime-stream');
        Route::post('/devices/push-token', [RealtimeController::class, 'registerPushToken']);
        Route::delete('/devices/push-token', [RealtimeController::class, 'unregisterPushToken']);

        // Organization directory, categories, notifications & audit logs
        Route::get('/offices', [DirectoryController::class, 'offices']);
        Route::get('/personnel', [DirectoryController::class, 'personnel']);
        Route::get('/categories', [DirectoryController::class, 'categories']);
        Route::post('/categories', [DirectoryController::class, 'declareCategory']);
        Route::get('/notifications', [DirectoryController::class, 'notifications']);
        Route::post('/notifications/{id}/read', [DirectoryController::class, 'markNotificationRead']);
        Route::post('/notifications/read-all', [DirectoryController::class, 'markAllNotificationsRead']);
        Route::get('/audit-logs', [DirectoryController::class, 'auditLogs']);
        Route::get('/documents/{id}/audit-logs', [DirectoryController::class, 'documentAuditLogs']);

        // Document custody, tracking & workflows
        Route::get('/documents', [DocumentController::class, 'index']);
        Route::get('/documents/tracked', [DocumentController::class, 'tracked']);
        Route::get('/documents/track/{code}', [DocumentController::class, 'trackByCode']);
        Route::get('/documents/{id}', [DocumentController::class, 'show']);
        Route::patch('/documents/{id}', [DocumentController::class, 'update']);
        Route::post('/documents', [DocumentController::class, 'storeDigital'])
            ->middleware('throttle:document-write');
        Route::post('/documents/digital', [DocumentController::class, 'storeDigital'])
            ->middleware('throttle:document-write');
        Route::post('/documents/hard-copy', [DocumentController::class, 'storeHardCopy'])
            ->middleware('throttle:document-write');
        Route::post('/documents/{id}/acknowledge', [DocumentController::class, 'acknowledge'])
            ->middleware('throttle:document-acknowledge');
        Route::post('/documents/{id}/unlock-challenge', [DocumentController::class, 'createUnlockChallenge']);
        Route::post('/documents/{id}/forward', [DocumentController::class, 'forward'])
            ->middleware('throttle:document-write');
        Route::post('/documents/{id}/recall', [DocumentController::class, 'recall']);
        Route::post('/documents/{id}/decline', [DocumentController::class, 'decline']);
        Route::post('/documents/{id}/return-revision', [DocumentController::class, 'returnForRevision']);
        Route::post('/documents/{id}/return', [DocumentController::class, 'returnForRevision']);
        Route::post('/documents/{id}/versions', [DocumentController::class, 'uploadRevision'])
            ->middleware('throttle:document-write');
        Route::post('/documents/{id}/revisions', [DocumentController::class, 'uploadRevision'])
            ->middleware('throttle:document-write');
        Route::post('/documents/{id}/complete', [DocumentController::class, 'complete']);
        Route::get('/documents/{id}/comments', [DocumentController::class, 'comments']);
        Route::post('/documents/{id}/comments', [DocumentController::class, 'storeComment']);
        Route::post('/documents/{id}/versions/{versionNumber}/presigned-url', [DocumentController::class, 'presignedUrl']);
        Route::post('/documents/{id}/transactions/{transactionId}/proof-url', [DocumentController::class, 'proofPhotoUrl']);

        // Saved routing templates & SLA turnaround analytics
        Route::get('/routing-templates', [RoutingTemplateController::class, 'index']);
        Route::post('/routing-templates', [RoutingTemplateController::class, 'store']);
        Route::delete('/routing-templates/{id}', [RoutingTemplateController::class, 'destroy']);
        Route::get('/analytics/turnaround', [AnalyticsController::class, 'turnaround']);
        Route::get('/analytics/contributions', [AnalyticsController::class, 'contributions']);

        // Opaque QR resolution, desktop pairing & mobile sanitized captures
        Route::post('/qr/resolve-document', [QrController::class, 'resolveDocument']);
        Route::get('/qr/document/{token}', [QrController::class, 'resolveDocument']);
        Route::post('/qr/consume-unlock', [QrController::class, 'consumeUnlock'])
            ->middleware('throttle:qr-unlock-consume');
        Route::post('/qr/desktop-pair', [QrController::class, 'createDesktopPair']);
        Route::post('/qr/resolve-pair', [QrController::class, 'resolveDesktopPair']);
        Route::get('/qr/desktop-pair/{token}', [QrController::class, 'resolveDesktopPair']);
        Route::get('/qr/desktop-pair/{token}/status', [QrController::class, 'desktopPairStatus']);
        Route::post('/attachments/mobile-capture', [QrController::class, 'uploadMobileCapture']);
    });
});
