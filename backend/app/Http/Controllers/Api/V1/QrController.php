<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiDomainException;
use App\Http\Controllers\Controller;
use App\Models\DesktopPairing;
use App\Models\Document;
use App\Models\MobileCapture;
use App\Models\User;
use App\Services\AccessPolicyService;
use App\Services\AuditLogger;
use App\Services\DocumentWorkflowService;
use App\Support\DtoSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class QrController extends Controller
{
    public function __construct(
        private readonly AccessPolicyService $policy,
        private readonly DocumentWorkflowService $workflow,
        private readonly AuditLogger $audit,
    ) {}

    public function resolveDocument(Request $request, ?string $token = null): JsonResponse
    {
        $raw = (string) ($token ?? $request->input('token', ''));
        $opaqueToken = $this->stripPrefix($raw, 'TRC-QR:DOC:');
        $opaqueToken = $this->stripPrefix($opaqueToken, 'TRC-QR:VERIFY:');
        $opaqueToken = $this->stripPrefix($opaqueToken, 'SDO-QR:DOC:');
        $opaqueToken = $this->stripPrefix($opaqueToken, 'SDO-QR:VERIFY:');
        $clean = trim($opaqueToken);

        if ($clean === '') {
            throw new ApiDomainException('QR_DOCUMENT_NOT_FOUND', 'Enter a valid tracking code or QR token.', 422);
        }

        $cleanLower = strtolower($clean);
        $cleanUpper = strtoupper($clean);

        $doc = Document::query()
            ->with(['participants', 'transactions'])
            ->where(function ($query) use ($clean, $cleanLower, $cleanUpper): void {
                $query->where('qr_token', $clean)
                    ->orWhereRaw('LOWER(qr_token) = ?', [$cleanLower])
                    ->orWhereRaw('UPPER(tracking_code) = ?', [$cleanUpper]);
            })
            ->first();
        if (! $doc) {
            throw new ApiDomainException(
                'QR_DOCUMENT_NOT_FOUND',
                'No document matches this QR token or tracking code.',
                404,
            );
        }

        /** @var User $actor */
        $actor = $request->user();
        $decision = $this->policy->authorizeFullCustody($actor, $doc);
        $deviceLabel = $actor->currentAccessToken()?->name ?? 'Tracely Client';

        if (! $decision['allowed']) {
            $this->audit->record(
                $actor,
                'qr_access_denied',
                $doc->id,
                $doc->tracking_code,
                "QR custody denied ({$decision['code']}) for {$doc->tracking_code}",
                $deviceLabel,
            );
            throw new ApiDomainException($decision['code'], $decision['reason'], 403);
        }

        $this->audit->record(
            $actor,
            'qr_scanned',
            $doc->id,
            $doc->tracking_code,
            "Resolved QR token for {$doc->tracking_code}",
            $deviceLabel,
        );

        $latest = $doc->latestTransaction();

        return response()->json([
            'data' => DtoSerializer::document($doc, $actor, $this->policy, revealAfterScan: true),
            'pending_for_actor_office' => $latest?->canBeAcknowledgedBy($actor) ?? false,
            'sent_by_actor' => $latest?->isPendingSentBy($actor->id) ?? false,
            'verification_code' => $doc->qr_token,
        ]);
    }

    public function createDesktopPair(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'draft_label' => ['required', 'string', 'min:1', 'max:160'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $expiresAt = now()->addMinutes(10);

        $pairing = DesktopPairing::query()->create([
            'pair_token' => 'pair-'.bin2hex(random_bytes(8)),
            'owner_user_id' => $actor->id,
            'draft_label' => trim($validated['draft_label']),
            'expires_at' => $expiresAt,
        ]);

        return response()->json([
            'pair_token' => $pairing->pair_token,
            'owner_user_id' => $pairing->owner_user_id,
            'draft_label' => $pairing->draft_label,
            'expires_at' => $pairing->expires_at->toIso8601String(),
        ], 201);
    }

    public function resolveDesktopPair(Request $request, ?string $token = null): JsonResponse
    {
        $raw = (string) ($token ?? $request->input('token', ''));
        $pairToken = $this->stripPrefix($raw, 'TRC-QR:PAIR:');
        $pairToken = $this->stripPrefix($pairToken, 'SDO-QR:PAIR:');

        /** @var DesktopPairing|null $pairing */
        $pairing = DesktopPairing::query()->find($pairToken);
        if (! $pairing) {
            throw new ApiDomainException('PAIR_TOKEN_NOT_FOUND', 'Desktop pairing QR token was not found.', 404);
        }

        if ($pairing->expires_at->isPast()) {
            throw new ApiDomainException(
                'PAIR_TOKEN_EXPIRED',
                'Desktop pairing QR expired. Generate a fresh QR on your desktop session.',
            );
        }

        /** @var User $actor */
        $actor = $request->user();
        if ($pairing->owner_user_id !== $actor->id) {
            throw new ApiDomainException(
                'PAIR_USER_MISMATCH',
                'Pairing token belongs to another personnel session and cannot be used.',
                403,
            );
        }

        return response()->json([
            'pair_token' => $pairing->pair_token,
            'owner_user_id' => $pairing->owner_user_id,
            'draft_label' => $pairing->draft_label,
            'expires_at' => $pairing->expires_at->toIso8601String(),
        ]);
    }

    public function desktopPairStatus(string $token, Request $request): JsonResponse
    {
        /** @var DesktopPairing|null $pairing */
        $pairing = DesktopPairing::query()->find($token);
        if (! $pairing) {
            throw new ApiDomainException('PAIR_TOKEN_NOT_FOUND', 'Desktop pairing session was not found.', 404);
        }

        /** @var User $actor */
        $actor = $request->user();
        if ($pairing->owner_user_id !== $actor->id) {
            throw new ApiDomainException(
                'PAIR_USER_MISMATCH',
                'You are not authorized to poll this desktop pairing session.',
                403,
            );
        }

        return response()->json([
            'pair_token' => $pairing->pair_token,
            'attached' => $pairing->attached_file_name !== null,
            'file_name' => $pairing->attached_file_name,
            'sha256_checksum' => $pairing->attached_sha256,
            'compressed_bytes' => $pairing->attached_compressed_bytes,
            'uploaded_at' => $pairing->uploaded_at?->toIso8601String(),
        ]);
    }

    public function verifyTransmittal(Request $request, ?string $token = null): JsonResponse
    {
        $raw = (string) ($token ?? $request->input('token', ''));
        $opaqueToken = $this->stripPrefix($raw, 'TRC-QR:VERIFY:');
        $opaqueToken = $this->stripPrefix($opaqueToken, 'SDO-QR:VERIFY:');

        $doc = Document::query()
            ->with(['currentOffice', 'versions', 'externalMilestones'])
            ->where('qr_token', $opaqueToken)
            ->orWhereRaw('UPPER(tracking_code) = ?', [strtoupper($opaqueToken)])
            ->first();

        if (! $doc) {
            throw new ApiDomainException('TRANSMITTAL_NOT_FOUND', 'No transmittal matches this verification token.', 404);
        }

        $latestVersion = $doc->versions->last();
        $checksumShort = $latestVersion ? substr($latestVersion->sha256_checksum, 0, 12).'...' : 'Hard-Copy Only';

        return response()->json([
            'tracking_code' => $doc->tracking_code,
            'lifecycle_status' => $doc->lifecycle_status,
            'current_office_name' => $doc->currentOffice?->name ?? 'Workspace Office',
            'latest_checksum_short' => $checksumShort,
            'milestone_count' => $doc->externalMilestones->count(),
        ]);
    }

    public function uploadMobileCapture(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'target_type' => ['required', 'in:desktop_pair,receipt_proof,revision_draft'],
            'target_id' => ['required', 'string', 'max:64'],
            'sha256_checksum' => ['nullable', 'string', 'size:64', 'regex:/^[0-9a-fA-F]{64}$/'],
            'exif_stripped' => ['nullable'],
            'compressed_bytes' => ['nullable', 'integer', 'min:1'],
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:20480'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $file = $request->file('photo');
        $sha256 = $this->workflow->verifyUploadedFileChecksum($file, $validated['sha256_checksum'] ?? null);

        $captureId = 'cap-'.Str::uuid()->toString();
        $ext = strtolower($file->getClientOriginalExtension() ?: 'jpg');
        $storageKey = "captures/{$captureId}.{$ext}";
        Storage::disk('local')->putFileAs('captures', $file, "{$captureId}.{$ext}");

        if ($validated['target_type'] === 'desktop_pair') {
            /** @var DesktopPairing|null $pairing */
            $pairing = DesktopPairing::query()->find($validated['target_id']);
            if (! $pairing || $pairing->expires_at->isPast()) {
                throw new ApiDomainException('PAIR_TOKEN_EXPIRED', 'Desktop pairing QR is missing or expired.');
            }
            if ($pairing->owner_user_id !== $actor->id) {
                throw new ApiDomainException('PAIR_USER_MISMATCH', 'Pairing token belongs to another user.', 403);
            }

            $pairing->update([
                'attached_file_name' => $file->getClientOriginalName() ?: "capture.{$ext}",
                'attached_sha256' => $sha256,
                'attached_compressed_bytes' => (int) ($file->getSize() ?: ($validated['compressed_bytes'] ?? 0)),
                'attached_mime_type' => $file->getMimeType() ?: 'image/jpeg',
                'attached_storage_key' => $storageKey,
                'uploaded_at' => now(),
            ]);
        }

        MobileCapture::query()->create([
            'id' => $captureId,
            'uploader_id' => $actor->id,
            'target_type' => $validated['target_type'],
            'target_id' => $validated['target_id'],
            'file_name' => $file->getClientOriginalName() ?: "capture.{$ext}",
            'mime_type' => $file->getMimeType() ?: 'image/jpeg',
            'compressed_bytes' => (int) ($file->getSize() ?: ($validated['compressed_bytes'] ?? 0)),
            'sha256_checksum' => $sha256,
            'exif_stripped' => filter_var($request->input('exif_stripped', true), FILTER_VALIDATE_BOOLEAN),
            'storage_key' => $storageKey,
        ]);

        $this->audit->record(
            $actor,
            'mobile_photo_attached',
            null,
            null,
            "Uploaded sanitized mobile capture for {$validated['target_type']} ({$validated['target_id']})",
            $actor->currentAccessToken()?->name ?? 'Tracely Mobile',
        );

        return response()->json(['ok' => true, 'capture_id' => $captureId], 201);
    }

    public function consumeUnlock(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:180'],
            'token' => ['nullable', 'string', 'max:180'],
        ]);

        $raw = (string) ($validated['code'] ?? $validated['token'] ?? '');
        /** @var User $actor */
        $actor = $request->user();
        $deviceLabel = $actor->currentAccessToken()?->name ?? 'Tracely Mobile';

        $unlocked = $this->workflow->consumeUnlockChallenge($actor, $raw, $deviceLabel);

        return response()->json([
            'data' => DtoSerializer::document($unlocked, $actor, $this->policy),
            'message' => 'Document unlocked and synced across your devices.',
        ]);
    }

    private function stripPrefix(string $raw, string $prefix): string
    {
        $trimmed = trim($raw);
        if (stripos($trimmed, $prefix) === 0) {
            return trim(substr($trimmed, strlen($prefix)));
        }

        return $trimmed;
    }
}
