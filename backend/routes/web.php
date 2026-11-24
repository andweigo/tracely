<?php

use App\Http\Controllers\Admin\AdminPortalController;
use App\Http\Controllers\MobileReleaseController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/download', [MobileReleaseController::class, 'showDownloadPage'])->name('mobile.download.page');
Route::get('/download/tracely.apk', [MobileReleaseController::class, 'downloadApk'])->name('mobile.download.apk');

Route::prefix('admin')->name('admin.')->group(function (): void {
    Route::get('/login', [AdminPortalController::class, 'showLogin'])->name('login');
    Route::post('/login', [AdminPortalController::class, 'login'])->name('login.submit');
    Route::post('/logout', [AdminPortalController::class, 'logout'])->name('logout');

    Route::get('/', [AdminPortalController::class, 'dashboard'])->name('dashboard');
    Route::get('/live-pulse', [AdminPortalController::class, 'livePulse'])->name('live-pulse');

    // 02 / Approvals Gate
    Route::post('/users/approve-all', [AdminPortalController::class, 'approveAllPending'])->name('users.approve-all');
    Route::post('/users/{id}/approve', [AdminPortalController::class, 'approveUser'])->name('users.approve');
    Route::post('/users/{id}/reject', [AdminPortalController::class, 'rejectUser'])->name('users.reject');

    // 03 / Administrators & Personnel Directory, RBAC, Provisioning, Delegate Override & Custody Reassignment
    Route::post('/admins', [AdminPortalController::class, 'provisionAdmin'])->name('admins.provision');
    Route::post('/users', [AdminPortalController::class, 'provisionUser'])->name('users.provision');
    Route::patch('/users/{id}', [AdminPortalController::class, 'updateUser'])->name('users.update');
    Route::post('/users/{id}/reset-password', [AdminPortalController::class, 'resetUserPassword'])->name('users.reset-password');
    Route::post('/users/{id}/toggle-active', [AdminPortalController::class, 'toggleUserActive'])->name('users.toggle-active');
    Route::post('/users/{id}/reassign-custody', [AdminPortalController::class, 'reassignUserCustody'])->name('users.reassign-custody');
    Route::post('/users/{id}/revoke-all-sessions', [AdminPortalController::class, 'revokeUserSessions'])->name('users.revoke-sessions');

    // 04 / Offices & Units
    Route::post('/offices', [AdminPortalController::class, 'createOffice'])->name('offices.create');
    Route::patch('/offices/{id}', [AdminPortalController::class, 'updateOffice'])->name('offices.update');

    // 05 & 06 / Custody Overrides, Office Follow-Up Alerts, Categories & SLA Policy Engine
    Route::post('/categories', [AdminPortalController::class, 'createCategory'])->name('categories.create');
    Route::patch('/categories/{id}', [AdminPortalController::class, 'updateCategory'])->name('categories.update');
    Route::delete('/categories/{id}', [AdminPortalController::class, 'deleteCategory'])->name('categories.delete');
    Route::post('/sla-policies', [AdminPortalController::class, 'saveSlaPolicy'])->name('sla-policies.save');
    Route::delete('/sla-policies/{id}', [AdminPortalController::class, 'deleteSlaPolicy'])->name('sla-policies.delete');
    Route::post('/documents/{id}/recall', [AdminPortalController::class, 'forceRecallDocument'])->name('documents.recall');
    Route::post('/documents/{id}/complete', [AdminPortalController::class, 'completeDocument'])->name('documents.complete');
    Route::post('/documents/{id}/notify-office', [AdminPortalController::class, 'notifyOffice'])->name('documents.notify-office');
    Route::post('/alerts/run-stalled-sweep', [AdminPortalController::class, 'runStalledSweep'])->name('alerts.sweep');

    // 07 / Security & Infrastructure Governance (Sanctum Sessions, SHA-256 Integrity, Push Diagnostics)
    Route::delete('/sessions/{tokenId}', [AdminPortalController::class, 'revokeSession'])->name('sessions.revoke');
    Route::post('/sessions/revoke-all-non-admin', [AdminPortalController::class, 'revokeAllStaffSessions'])->name('sessions.revoke-all');
    Route::post('/integrity/verify', [AdminPortalController::class, 'runIntegrityAudit'])->name('integrity.verify');
    Route::post('/diagnostics/test-push', [AdminPortalController::class, 'sendDiagnosticPush'])->name('diagnostics.test-push');
    Route::delete('/diagnostics/tokens/{id}', [AdminPortalController::class, 'deletePushToken'])->name('diagnostics.delete-token');

    // 08 / Executive A4 SLA Report & CSV Exports
    Route::get('/reports/executive-sla', [AdminPortalController::class, 'executiveSlaReport'])->name('reports.executive-sla');
    Route::get('/export/documents.csv', [AdminPortalController::class, 'exportDocumentsCsv'])->name('export.documents');
    Route::get('/export/audit-logs.csv', [AdminPortalController::class, 'exportAuditLogsCsv'])->name('export.audit-logs');
});
