<?php

namespace App\Services;

use App\Exceptions\ApiDomainException;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentComment;
use App\Models\DocumentUnlockChallenge;
use App\Models\DocumentVersion;
use App\Models\ExternalMilestone;
use App\Models\RoutingTransaction;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DocumentWorkflowService
{
    public function __construct(
        private readonly AccessPolicyService $policy,
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
    ) {}

    public function resolveRecipient(
        string $recipientUserId,
        bool $routeToDelegateIfOnLeave,
    ): User {
        /** @var User|null $recipient */
        $recipient = User::query()->with(['office', 'delegate.office'])->find($recipientUserId);
        if (! $recipient || ! $recipient->active || $recipient->approval_status !== 'approved') {
            throw new ApiDomainException('RECIPIENT_NOT_FOUND', 'Selected recipient was not found.');
        }

        if ($recipient->canReceiveDirectRouting()) {
            return $recipient;
        }

        if (! $routeToDelegateIfOnLeave || ! $recipient->delegate_id) {
            throw new ApiDomainException(
                'RECIPIENT_ON_LEAVE',
                "{$recipient->full_name} is currently On Leave and cannot receive direct routing.",
            );
        }

        $delegate = $recipient->delegate;
        if (! $delegate || ! $delegate->canReceiveDirectRouting()) {
            throw new ApiDomainException(
                'DELEGATE_UNAVAILABLE',
                "{$recipient->full_name} has no available delegate.",
            );
        }

        return $delegate;
    }

    public function verifyUploadedFileChecksum(UploadedFile $file, ?string $declaredSha256): string
    {
        $realPath = $file->getRealPath();
        $actualHash = $realPath ? hash_file('sha256', $realPath) : hash('sha256', (string) $file->get());

        if ($declaredSha256 !== null && trim($declaredSha256) !== '') {
            $normalized = strtolower(trim($declaredSha256));
            if (! hash_equals($normalized, strtolower($actualHash))) {
                throw new ApiDomainException(
                    'CHECKSUM_MISMATCH',
                    'Uploaded file SHA-256 integrity check failed.',
                );
            }
        }

        return strtolower($actualHash);
    }

    public function createDigitalDocument(
        User $actor,
        array $input,
        UploadedFile $file,
        string $deviceLabel,
    ): Document {
        if (! $actor->active || $actor->approval_status !== 'approved') {
            throw new ApiDomainException('ACCOUNT_INACTIVE', 'Account cannot register documents.', 403);
        }

        $category = DocumentCategory::query()->find($input['category_id']);
        if (! $category) {
            throw new ApiDomainException('MISSING_CATEGORY', 'Select a valid document category.');
        }

        $recipient = ! empty($input['recipient_user_id'])
            ? $this->resolveRecipient(
                (string) $input['recipient_user_id'],
                (bool) ($input['route_to_delegate_if_on_leave'] ?? false),
            )
            : null;

        if ($recipient && $recipient->id === $actor->id) {
            throw new ApiDomainException(
                'SELF_DISPATCH_NOT_ALLOWED',
                'You cannot send a document to your own account. Leave recipient blank to hold it locally.',
                422,
            );
        }

        $sha256 = $this->verifyUploadedFileChecksum($file, $input['sha256_checksum'] ?? null);
        $docId = 'doc-'.Str::uuid()->toString();
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin');
        $resolvedFileName = $this->resolveStoredFileName(
            $file,
            isset($input['file_name']) ? (string) $input['file_name'] : null,
            "document.{$ext}",
        );
        $storageKey = "docs/{$docId}/v1.{$ext}";
        Storage::disk('local')->putFileAs("docs/{$docId}", $file, "v1.{$ext}");

        return DB::transaction(function () use ($actor, $input, $category, $recipient, $file, $sha256, $docId, $storageKey, $resolvedFileName, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();
            $trackingCode = $this->nextTrackingCode();

            $doc = Document::query()->create([
                'id' => $docId,
                'tracking_code' => $trackingCode,
                'qr_token' => bin2hex(random_bytes(16)),
                'title' => trim((string) $input['title']),
                'category_id' => $category->id,
                'confidentiality_tier' => $input['confidentiality_tier'],
                'lifecycle_status' => $recipient ? 'in_transit' : 'in_review',
                'copy_format' => 'digital',
                'sla_due_at' => $this->computeSlaDueAt((string) $input['confidentiality_tier'], $category),
                'origin_office_id' => $actor->office_id,
                'origin_user_id' => $actor->id,
                'current_office_id' => $recipient?->office_id ?? $actor->office_id,
                'current_holder_id' => $recipient?->id ?? $actor->id,
            ]);

            $participantIds = array_values(array_unique(array_filter([$actor->id, $recipient?->id])));
            $doc->participants()->sync($participantIds);

            $initialChangeType = in_array(
                (string) ($input['change_type'] ?? ''),
                ['initial', 'signed', 'revised', 'endorsed', 'supporting_attachment'],
                true,
            )
                ? (string) $input['change_type']
                : 'initial';

            DocumentVersion::query()->create([
                'id' => 'ver-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'version_number' => 1,
                'change_type' => $initialChangeType,
                'file_name' => $resolvedFileName,
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'size_bytes' => (int) ($file->getSize() ?: ($input['size_bytes'] ?? 0)),
                'sha256_checksum' => $sha256,
                'uploaded_by_id' => $actor->id,
                'uploaded_by_office_id' => $actor->office_id,
                'uploaded_by_office_code' => $actor->office?->code ?? 'UNIT',
                'uploaded_by_office_name' => $actor->office?->name ?? 'Office Unit',
                'uploaded_at' => $now,
                'revision_note' => trim((string) ($input['remarks'] ?? '')) ?: 'Initial digital document upload',
                'storage_key' => $storageKey,
            ]);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Registered at {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            if ($recipient) {
                $this->createDispatchTransaction($actor, $doc, $recipient, (string) ($input['remarks'] ?? ''), $now);
            } else {
                $this->realtime->publish(
                    'document_created',
                    [$actor->office_id],
                    [$actor->id],
                    $doc->id,
                );
            }

            $category->increment('usage_count');

            $this->audit->record(
                $actor,
                'version_uploaded',
                $doc->id,
                $doc->tracking_code,
                $recipient
                    ? "Uploaded v1 & dispatched {$doc->tracking_code} to {$recipient->office->code}"
                    : "Uploaded v1 & held {$doc->tracking_code} at {$actor->office->code}",
                $deviceLabel,
            );

            return $doc->fresh();
        });
    }

    public function registerHardCopyDocument(
        User $actor,
        array $input,
        string $deviceLabel,
    ): Document {
        if (! $actor->active || $actor->approval_status !== 'approved') {
            throw new ApiDomainException('ACCOUNT_INACTIVE', 'Account cannot register documents.', 403);
        }

        $category = DocumentCategory::query()->find($input['category_id']);
        if (! $category) {
            throw new ApiDomainException('MISSING_CATEGORY', 'Select a valid document category.');
        }

        $recipient = ! empty($input['recipient_user_id'])
            ? $this->resolveRecipient(
                (string) $input['recipient_user_id'],
                (bool) ($input['route_to_delegate_if_on_leave'] ?? false),
            )
            : null;

        if ($recipient && $recipient->id === $actor->id) {
            throw new ApiDomainException(
                'SELF_DISPATCH_NOT_ALLOWED',
                'You cannot send a document to your own account. Leave recipient blank to hold it locally.',
                422,
            );
        }

        return DB::transaction(function () use ($actor, $input, $category, $recipient, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();
            $docId = 'doc-'.Str::uuid()->toString();
            $trackingCode = $this->nextTrackingCode();

            $doc = Document::query()->create([
                'id' => $docId,
                'tracking_code' => $trackingCode,
                'qr_token' => bin2hex(random_bytes(16)),
                'title' => trim((string) $input['title']),
                'category_id' => $category->id,
                'confidentiality_tier' => $input['confidentiality_tier'],
                'lifecycle_status' => $recipient ? 'in_transit' : 'registered',
                'copy_format' => 'hard_copy',
                'physical_reference' => isset($input['physical_reference']) && trim((string) $input['physical_reference']) !== ''
                    ? trim((string) $input['physical_reference'])
                    : null,
                'physical_page_count' => $input['physical_page_count'] ?? null,
                'sla_due_at' => $this->computeSlaDueAt((string) $input['confidentiality_tier'], $category),
                'origin_office_id' => $actor->office_id,
                'origin_user_id' => $actor->id,
                'current_office_id' => $recipient?->office_id ?? $actor->office_id,
                'current_holder_id' => $recipient?->id ?? $actor->id,
            ]);

            $participantIds = array_values(array_unique(array_filter([$actor->id, $recipient?->id])));
            $doc->participants()->sync($participantIds);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Hard Copy Registered at {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            if ($recipient) {
                $this->createDispatchTransaction($actor, $doc, $recipient, (string) ($input['remarks'] ?? ''), $now);
            } else {
                $this->realtime->publish(
                    'document_created',
                    [$actor->office_id],
                    [$actor->id],
                    $doc->id,
                );
            }

            $category->increment('usage_count');

            $this->audit->record(
                $actor,
                'forwarded',
                $doc->id,
                $doc->tracking_code,
                $recipient
                    ? "Issued physical QR slip {$doc->tracking_code} & routed to {$recipient->office->code}"
                    : "Issued physical QR slip {$doc->tracking_code} at {$actor->office->code}",
                $deviceLabel,
            );

            return $doc->fresh();
        });
    }

    public function acknowledge(
        User $actor,
        Document $doc,
        ?UploadedFile $proofPhoto,
        ?string $proofSha256,
        bool $exifStripped,
        string $deviceLabel,
        ?string $verificationCode = null,
        ?string $password = null,
        ?string $trustedMethodNote = null,
    ): Document {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        $latest = $doc->latestTransaction();
        if ($latest && $latest->isPendingSentBy($actor->id)) {
            throw new ApiDomainException(
                'SELF_RECEIPT_NOT_ALLOWED',
                'You cannot confirm receipt of a document you sent. Wait for the intended recipient to scan or confirm it.',
                422,
            );
        }
        if (! $latest || ! $latest->canBeAcknowledgedBy($actor)) {
            throw new ApiDomainException(
                'NO_PENDING_RECEIPT',
                'There is no pending transfer to your office awaiting digital acknowledgment.',
            );
        }

        $verificationMethod = 'verified via routing QR';
        if ($trustedMethodNote !== null) {
            $verificationMethod = $trustedMethodNote;
        } elseif ($password !== null && trim($password) !== '') {
            if ($doc->copy_format !== 'digital') {
                throw new ApiDomainException(
                    'PASSWORD_UNLOCK_NOT_ALLOWED',
                    'Password unlock is only available for Soft Copy transfers. Scan the printed routing slip QR for physical folders.',
                    422,
                );
            }
            if (! Hash::check($password, (string) $actor->password)) {
                throw new ApiDomainException(
                    'INVALID_PASSWORD',
                    'Incorrect account password. Please try again.',
                    422,
                );
            }
            $verificationMethod = 'verified via account password';
        } else {
            $this->assertValidQrVerificationCode($doc, $verificationCode);
        }

        $proofStorageKey = null;
        $verifiedProofHash = null;
        if ($proofPhoto) {
            $verifiedProofHash = $this->verifyUploadedFileChecksum($proofPhoto, $proofSha256);
            $ext = strtolower($proofPhoto->getClientOriginalExtension() ?: 'jpg');
            $proofStorageKey = "proofs/{$doc->id}/{$latest->id}.{$ext}";
            Storage::disk('local')->putFileAs("proofs/{$doc->id}", $proofPhoto, "{$latest->id}.{$ext}");
        }

        return DB::transaction(function () use ($actor, $doc, $latest, $proofPhoto, $verifiedProofHash, $exifStripped, $proofStorageKey, $deviceLabel, $verificationMethod): Document {
            $actor->loadMissing('office');
            $now = now();

            $latest->update([
                'receipt_status' => 'acknowledged',
                'acknowledged_at' => $now,
                'acknowledged_by_name' => $actor->full_name,
                'proof_photo_file_name' => $proofPhoto?->getClientOriginalName(),
                'proof_photo_compressed_bytes' => $proofPhoto?->getSize(),
                'proof_photo_sha256' => $verifiedProofHash,
                'proof_photo_exif_stripped' => $proofPhoto ? $exifStripped : null,
                'proof_photo_storage_key' => $proofStorageKey,
                'proof_photo_captured_at' => $proofPhoto ? $now : null,
            ]);

            $doc->update([
                'lifecycle_status' => 'in_review',
                'current_office_id' => $actor->office_id,
                'current_holder_id' => $actor->id,
            ]);
            $doc->participants()->syncWithoutDetaching([$actor->id]);

            DocumentUnlockChallenge::query()
                ->where('document_id', $doc->id)
                ->where('user_id', $actor->id)
                ->whereNull('consumed_at')
                ->update([
                    'consumed_at' => $now,
                    'consumed_device_label' => $deviceLabel,
                ]);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Received by {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            $this->audit->record(
                $actor,
                'acknowledged',
                $doc->id,
                $doc->tracking_code,
                $proofPhoto
                    ? "Acknowledged custody of {$doc->tracking_code} with EXIF-stripped proof photo ({$verificationMethod})"
                    : "Acknowledged digital receipt of {$doc->tracking_code} ({$verificationMethod})",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_acknowledged',
                [$actor->office_id, $latest->from_office_id],
                [$actor->id, $latest->from_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    public function createUnlockChallenge(User $actor, Document $doc): DocumentUnlockChallenge
    {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($doc->copy_format !== 'digital') {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_DIGITAL_ONLY',
                'Live Desktop-to-Mobile unlock QR is for Soft Copy documents. Scan the printed paper routing slip QR for physical folders.',
                422,
            );
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->isPendingSentBy($actor->id)) {
            throw new ApiDomainException(
                'SELF_RECEIPT_NOT_ALLOWED',
                'You cannot generate an unlock QR for a document you sent.',
                422,
            );
        }
        if (! $latest || ! $latest->canBeAcknowledgedBy($actor)) {
            throw new ApiDomainException(
                'NO_PENDING_RECEIPT',
                'This document has no pending transfer awaiting your receipt.',
                422,
            );
        }

        // Reuse the active, unexpired unlock challenge for this user + document so closing
        // and reopening the QR modal does not rotate the code before its duration ends.
        /** @var DocumentUnlockChallenge|null $existing */
        $existing = DocumentUnlockChallenge::query()
            ->where('document_id', $doc->id)
            ->where('user_id', $actor->id)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->first();

        if ($existing) {
            return $existing;
        }

        // Remove expired unconsumed challenges before generating a fresh 5-minute code
        DocumentUnlockChallenge::query()
            ->where('document_id', $doc->id)
            ->where('user_id', $actor->id)
            ->whereNull('consumed_at')
            ->where('expires_at', '<=', now())
            ->delete();

        $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        $shortCode = '';
        for ($i = 0; $i < 6; $i++) {
            $shortCode .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return DocumentUnlockChallenge::query()->create([
            'id' => 'ulk-'.Str::uuid()->toString(),
            'token' => bin2hex(random_bytes(16)),
            'short_code' => $shortCode,
            'document_id' => $doc->id,
            'user_id' => $actor->id,
            'office_id' => $actor->office_id,
            'expires_at' => now()->addMinutes(5),
        ]);
    }

    public function consumeUnlockChallenge(
        User $actor,
        string $rawCodeOrToken,
        string $deviceLabel = 'Tracely Mobile',
        ?string $expectedDocumentId = null,
    ): Document {
        $clean = trim($rawCodeOrToken);
        foreach (['TRC-QR:UNLOCK:', 'SDO-QR:UNLOCK:'] as $prefix) {
            if (stripos($clean, $prefix) === 0) {
                $clean = trim(substr($clean, strlen($prefix)));
            }
        }

        if ($clean === '') {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_NOT_FOUND',
                'Enter a valid unlock QR or 6-character code.',
                422,
            );
        }

        $normalizedShort = strtoupper(preg_replace('/[^A-Z0-9]/i', '', $clean) ?: '');

        /** @var DocumentUnlockChallenge|null $challenge */
        $challenge = DocumentUnlockChallenge::query()
            ->where('token', $clean)
            ->orWhere(function ($q) use ($actor, $normalizedShort): void {
                $q->where('user_id', $actor->id)
                    ->where('short_code', $normalizedShort);
            })
            ->orderByDesc('created_at')
            ->first();

        // Also detect cross-account short code attempts clearly
        if (! $challenge && strlen($normalizedShort) === 6) {
            $foreign = DocumentUnlockChallenge::query()
                ->where('short_code', $normalizedShort)
                ->whereNull('consumed_at')
                ->where('expires_at', '>', now())
                ->first();
            if ($foreign) {
                throw new ApiDomainException(
                    'UNLOCK_CHALLENGE_USER_MISMATCH',
                    'This unlock code belongs to a different Tracely account.',
                    403,
                );
            }
        }

        if (! $challenge) {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_NOT_FOUND',
                'Unlock QR or code was not found. Check the active code and try again.',
                404,
            );
        }

        if ($challenge->user_id !== $actor->id) {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_USER_MISMATCH',
                'This unlock QR belongs to a different Tracely account.',
                403,
            );
        }

        $targetDocumentId = trim((string) ($expectedDocumentId ?? ''));
        if ($targetDocumentId !== '' && $challenge->document_id !== $targetDocumentId) {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_DOCUMENT_MISMATCH',
                'This unlock code belongs to a different sealed document.',
                422,
            );
        }

        if ($challenge->consumed_at !== null) {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_USED',
                'This unlock QR has already been used.',
                422,
            );
        }

        if ($challenge->expires_at->isPast()) {
            throw new ApiDomainException(
                'UNLOCK_CHALLENGE_EXPIRED',
                'This unlock QR has expired. Generate a fresh code and try again.',
                422,
            );
        }

        $doc = Document::query()
            ->with(['participants', 'transactions', 'originOffice', 'currentOffice'])
            ->findOrFail($challenge->document_id);

        $viaShortCode = strlen($normalizedShort) === 6 && strtoupper($challenge->short_code) === $normalizedShort && $challenge->token !== $clean;
        $isWebClient = str_contains(strtolower($deviceLabel), 'web');
        $methodNote = $viaShortCode
            ? ($isWebClient ? 'verified via Web unlock code' : 'verified via Mobile ↔ Web unlock code')
            : 'verified via Mobile ↔ Web QR sync';

        $challenge->update([
            'consumed_at' => now(),
            'consumed_device_label' => $deviceLabel,
        ]);

        return $this->acknowledge(
            $actor,
            $doc,
            null,
            null,
            true,
            $deviceLabel,
            null,
            null,
            $methodNote,
        );
    }

    public function forward(
        User $actor,
        Document $doc,
        string $recipientUserId,
        string $remarks,
        bool $routeToDelegateIfOnLeave,
        string $deviceLabel,
    ): Document {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($doc->lifecycle_status === 'archived') {
            throw new ApiDomainException(
                'DOCUMENT_CLOSED',
                'This document is archived and closed. Archived documents can no longer be forwarded.',
            );
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->receipt_status === 'pending') {
            if ($latest->isPendingForOffice($actor->office_id)) {
                throw new ApiDomainException(
                    'ACCEPT_BEFORE_FORWARD',
                    'Confirm digital receipt of this incoming document before forwarding it onward.',
                );
            }
            throw new ApiDomainException(
                'IN_TRANSIT_LOCKED',
                'Document is currently in transit awaiting recipient acknowledgment.',
            );
        }

        $recipient = $this->resolveRecipient($recipientUserId, $routeToDelegateIfOnLeave);
        if ($recipient->id === $actor->id) {
            throw new ApiDomainException(
                'SELF_DISPATCH_NOT_ALLOWED',
                'You cannot forward a document to your own account.',
                422,
            );
        }

        return DB::transaction(function () use ($actor, $doc, $recipient, $remarks, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();

            $doc->update([
                'lifecycle_status' => 'in_transit',
                'current_office_id' => $recipient->office_id,
                'current_holder_id' => $recipient->id,
            ]);
            $doc->participants()->syncWithoutDetaching([$actor->id, $recipient->id]);

            $this->createDispatchTransaction($actor, $doc, $recipient, $remarks, $now);

            $this->audit->record(
                $actor,
                'forwarded',
                $doc->id,
                $doc->tracking_code,
                "Forwarded {$doc->tracking_code} to {$recipient->office->code} ({$recipient->full_name})",
                $deviceLabel,
            );

            return $doc->fresh();
        });
    }

    public function recall(User $actor, Document $doc, string $deviceLabel): Document
    {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        $latest = $doc->latestTransaction();
        if (! $latest || ! $latest->canBeRecalledBy($actor->id)) {
            throw new ApiDomainException(
                'RECALL_NOT_ALLOWED',
                'Cannot recall a document after the recipient has acknowledged or acted on it.',
            );
        }

        return DB::transaction(function () use ($actor, $doc, $latest, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();

            $latest->update([
                'receipt_status' => 'recalled',
            ]);

            $doc->update([
                'lifecycle_status' => 'in_review',
                'current_office_id' => $actor->office_id,
                'current_holder_id' => $actor->id,
            ]);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Recalled by {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            $this->audit->record(
                $actor,
                'recalled',
                $doc->id,
                $doc->tracking_code,
                "Recalled pending transfer of {$doc->tracking_code}",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_recalled',
                [$actor->office_id, $latest->to_office_id],
                [$actor->id, $latest->to_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    public function updateDocumentDetails(
        User $actor,
        Document $doc,
        array $input,
        string $deviceLabel,
    ): Document {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if (in_array($doc->lifecycle_status, ['approved', 'archived'], true)) {
            throw new ApiDomainException(
                'DOCUMENT_ALREADY_FINALIZED',
                'Cannot edit a document that has already been approved or archived.',
            );
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->receipt_status === 'pending') {
            throw new ApiDomainException(
                'DOCUMENT_IN_TRANSIT',
                'Recall the pending transfer first before editing document details.',
            );
        }

        if ($doc->current_office_id !== $actor->office_id) {
            throw new ApiDomainException(
                'CUSTODY_REQUIRED',
                'Only the current holding office can edit document details after recall or return.',
                403,
            );
        }

        $updates = [];
        if (isset($input['title']) && trim((string) $input['title']) !== '') {
            $updates['title'] = trim((string) $input['title']);
        }
        if (isset($input['category_id'])) {
            $cat = DocumentCategory::query()->find($input['category_id']);
            if (! $cat) {
                throw new ApiDomainException('MISSING_CATEGORY', 'Select a valid document category.');
            }
            $updates['category_id'] = $cat->id;
        }
        if (isset($input['confidentiality_tier'])) {
            $updates['confidentiality_tier'] = $input['confidentiality_tier'];
        }
        if (array_key_exists('physical_reference', $input)) {
            $ref = trim((string) ($input['physical_reference'] ?? ''));
            $updates['physical_reference'] = $ref !== '' ? $ref : null;
        }
        if (array_key_exists('physical_page_count', $input)) {
            $updates['physical_page_count'] = $input['physical_page_count'] !== null
                ? (int) $input['physical_page_count']
                : null;
        }

        return DB::transaction(function () use ($actor, $doc, $updates, $deviceLabel): Document {
            if ($updates !== []) {
                $doc->update($updates);
            }

            $this->audit->record(
                $actor,
                'document_updated',
                $doc->id,
                $doc->tracking_code,
                "Updated recalled/held document details for {$doc->tracking_code} (\"{$doc->title}\")",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_updated',
                [$actor->office_id, $doc->origin_office_id],
                [$actor->id, $doc->origin_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    public function decline(User $actor, Document $doc, string $reason, string $deviceLabel): Document
    {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        $cleanReason = trim($reason);
        if ($cleanReason === '') {
            throw new ApiDomainException('EMPTY_REASON', 'Decline reason must not be empty.');
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->isPendingSentBy($actor->id)) {
            throw new ApiDomainException(
                'SELF_DECLINE_NOT_ALLOWED',
                'You cannot decline your own dispatch. Use Recall Transfer instead.',
                422,
            );
        }
        if (! $latest || ! $latest->canBeAcknowledgedBy($actor)) {
            throw new ApiDomainException(
                'NO_PENDING_TRANSFER',
                'Only pending incoming transfers to your office can be declined.',
            );
        }

        return DB::transaction(function () use ($actor, $doc, $latest, $cleanReason, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();

            $latest->update([
                'receipt_status' => 'declined_misrouted',
                'remarks' => $cleanReason,
            ]);

            $doc->update([
                'lifecycle_status' => 'in_review',
                'current_office_id' => $latest->from_office_id,
                'current_holder_id' => $latest->from_user_id,
            ]);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Declined by {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            $this->notifyRecipient(
                $latest->from_user_id,
                $latest->from_office_id,
                $doc->id,
                "Misrouted Return · {$doc->tracking_code}",
                "{$doc->title} was declined by {$actor->office->code}: {$cleanReason}",
                'Pending return alert in Tracely.',
                "{$doc->tracking_code} declined by {$actor->office->code}: {$cleanReason}",
                $now,
            );

            $this->audit->record(
                $actor,
                'declined_misrouted',
                $doc->id,
                $doc->tracking_code,
                "Declined misrouted transfer ({$doc->tracking_code}): {$cleanReason}",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_declined',
                [$actor->office_id, $latest->from_office_id],
                [$actor->id, $latest->from_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    public function returnForRevision(User $actor, Document $doc, string $remarks, string $deviceLabel): Document
    {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->isSealedForActor($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Scan the sender\'s routing QR code to receive and review this document before returning it for revision (or use Decline if misrouted).',
                403,
            );
        }

        $cleanRemarks = trim($remarks);
        if ($cleanRemarks === '') {
            throw new ApiDomainException('EMPTY_REMARKS', 'Revision remarks must not be empty.');
        }

        return DB::transaction(function () use ($actor, $doc, $cleanRemarks, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();

            $latest = $doc->latestTransaction();
            if ($latest && $latest->receipt_status === 'pending') {
                $latest->update([
                    'receipt_status' => 'returned_for_revision',
                    'remarks' => $cleanRemarks,
                ]);
            }

            $doc->update([
                'lifecycle_status' => 'returned_for_revision',
                'current_office_id' => $doc->origin_office_id,
                'current_holder_id' => $doc->origin_user_id,
            ]);

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "Returned for Revision by {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            $this->notifyRecipient(
                $doc->origin_user_id,
                $doc->origin_office_id,
                $doc->id,
                "Revision Requested · {$doc->tracking_code}",
                "{$doc->title} was returned by {$actor->office->code} for revision: {$cleanRemarks}",
                'Pending revision notice in Tracely.',
                "{$doc->tracking_code} returned for revision: {$cleanRemarks}",
                $now,
            );

            $this->audit->record(
                $actor,
                'returned_for_revision',
                $doc->id,
                $doc->tracking_code,
                "Returned {$doc->tracking_code} for revision: {$cleanRemarks}",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_returned',
                [$actor->office_id, $doc->origin_office_id],
                [$actor->id, $doc->origin_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    public function uploadRevisionVersion(
        User $actor,
        Document $doc,
        UploadedFile $file,
        ?string $declaredSha256,
        string $revisionNote,
        string $deviceLabel,
        ?string $customFileName = null,
        ?string $changeType = null,
    ): Document {
        $doc->loadMissing(['versions', 'transactions', 'participants', 'originOffice', 'currentOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->isSealedForActor($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Unlock and confirm receipt of this document before attaching a signed or updated file.',
                403,
            );
        }

        if (in_array($doc->lifecycle_status, ['approved', 'archived'], true)) {
            throw new ApiDomainException(
                'DOCUMENT_ALREADY_FINALIZED',
                'Cannot attach a new file version to a document that has already been approved or archived.',
                422,
            );
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->receipt_status === 'pending') {
            throw new ApiDomainException(
                'DOCUMENT_IN_TRANSIT',
                'This document is currently in transit awaiting recipient receipt. Recall the transfer or wait until received before attaching a new version.',
                422,
            );
        }

        $hasExistingVersions = $doc->versions->isNotEmpty();
        $isHoldingCustody = $actor->id === $doc->current_holder_id
            || $actor->office_id === $doc->current_office_id;
        $isOriginRevision = $doc->lifecycle_status === 'returned_for_revision'
            && $actor->office_id === $doc->origin_office_id;

        if (! $hasExistingVersions) {
            $canAttachInitial = $isHoldingCustody || $actor->office_id === $doc->origin_office_id;
            if (! $canAttachInitial) {
                throw new ApiDomainException(
                    'INITIAL_SCAN_NOT_ALLOWED',
                    'Only the holding or originating office can attach the initial digital scan (v1).',
                    403,
                );
            }
        } elseif (! $isHoldingCustody && ! $isOriginRevision) {
            $holderCode = $doc->currentOffice?->code ?? 'holding office';
            throw new ApiDomainException(
                'CUSTODY_REQUIRED',
                "Only the office currently holding custody ({$holderCode}) can attach a signed copy or updated version.",
                403,
            );
        }

        $allowedChangeTypes = ['initial', 'signed', 'revised', 'endorsed', 'supporting_attachment'];
        $resolvedChangeType = in_array((string) ($changeType ?? ''), $allowedChangeTypes, true)
            ? (string) $changeType
            : (! $hasExistingVersions
                ? 'initial'
                : ($doc->lifecycle_status === 'returned_for_revision'
                    ? 'revised'
                    : ($actor->office_id !== $doc->origin_office_id ? 'signed' : 'revised')));

        $changeLabel = match ($resolvedChangeType) {
            'signed' => 'Signed Copy',
            'revised' => 'Revised Copy',
            'endorsed' => 'Endorsed Copy',
            'supporting_attachment' => 'Supporting File',
            default => $hasExistingVersions ? 'Updated Copy' : 'Initial Scan',
        };

        $sha256 = $this->verifyUploadedFileChecksum($file, $declaredSha256);
        $nextVersionNumber = ((int) $doc->versions->max('version_number')) + 1;
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin');
        $resolvedFileName = $this->resolveStoredFileName($file, $customFileName, "v{$nextVersionNumber}.{$ext}");
        $storageKey = "docs/{$doc->id}/v{$nextVersionNumber}.{$ext}";
        Storage::disk('local')->putFileAs("docs/{$doc->id}", $file, "v{$nextVersionNumber}.{$ext}");

        return DB::transaction(function () use ($actor, $doc, $file, $sha256, $nextVersionNumber, $storageKey, $resolvedFileName, $revisionNote, $hasExistingVersions, $resolvedChangeType, $changeLabel, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();
            $cleanNote = trim($revisionNote) ?: ($hasExistingVersions
                ? "{$changeLabel} attached by {$actor->office->code}"
                : 'Initial digital scan attached');

            DocumentVersion::query()->create([
                'id' => 'ver-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'version_number' => $nextVersionNumber,
                'change_type' => $resolvedChangeType,
                'file_name' => $resolvedFileName,
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'size_bytes' => (int) ($file->getSize() ?: 0),
                'sha256_checksum' => $sha256,
                'uploaded_by_id' => $actor->id,
                'uploaded_by_office_id' => $actor->office_id,
                'uploaded_by_office_code' => $actor->office?->code ?? 'UNIT',
                'uploaded_by_office_name' => $actor->office?->name ?? 'Office Unit',
                'uploaded_at' => $now,
                'revision_note' => $cleanNote,
                'storage_key' => $storageKey,
            ]);

            $doc->participants()->syncWithoutDetaching([$actor->id]);

            if (! $hasExistingVersions && $doc->copy_format === 'hard_copy') {
                $doc->update(['copy_format' => 'hybrid']);
            } elseif ($doc->lifecycle_status === 'returned_for_revision') {
                $doc->update(['lifecycle_status' => 'in_review']);
            }

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => "{$changeLabel} (v{$nextVersionNumber}) by {$actor->office->code}",
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            if ($doc->origin_user_id && $doc->origin_user_id !== $actor->id) {
                $this->notifyRecipient(
                    $doc->origin_user_id,
                    $doc->origin_office_id,
                    $doc->id,
                    "{$changeLabel} Attached · {$doc->tracking_code}",
                    "{$actor->office->code} ({$actor->full_name}) attached v{$nextVersionNumber} ({$resolvedFileName}) on {$doc->title}: {$cleanNote}",
                    "New document version attached by {$actor->office->code}.",
                    "{$doc->tracking_code} · {$changeLabel} v{$nextVersionNumber} by {$actor->office->code}",
                    $now,
                );
            }

            $this->audit->record(
                $actor,
                'version_uploaded',
                $doc->id,
                $doc->tracking_code,
                "Attached {$changeLabel} v{$nextVersionNumber} ({$resolvedFileName}) by {$actor->office->code}: {$cleanNote}",
                $deviceLabel,
            );

            $this->realtime->publish(
                'version_uploaded',
                [$actor->office_id, $doc->current_office_id, $doc->origin_office_id],
                [$actor->id, $doc->current_holder_id, $doc->origin_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    /**
     * Finalizes a document into Approved / Released or Archived terminal state so it clears active desks cleanly.
     */
    public function completeDocument(
        User $actor,
        Document $doc,
        string $targetStatus,
        string $remarks,
        string $deviceLabel,
    ): Document {
        $doc->loadMissing(['transactions', 'participants', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if (! in_array($targetStatus, ['approved', 'archived'], true)) {
            throw new ApiDomainException('INVALID_COMPLETION_STATUS', 'Status must be approved or archived.');
        }

        if ($doc->lifecycle_status === 'archived') {
            throw new ApiDomainException('DOCUMENT_CLOSED', 'This document is already archived and closed.');
        }

        if ($doc->lifecycle_status === $targetStatus) {
            throw new ApiDomainException(
                'ALREADY_FINALIZED',
                $targetStatus === 'approved'
                    ? 'This document is already marked Approved & Released.'
                    : 'This document is already archived.',
            );
        }

        $latest = $doc->latestTransaction();
        if ($latest && $latest->receipt_status === 'pending') {
            throw new ApiDomainException(
                'IN_TRANSIT_LOCKED',
                'Cannot finalize a document while a transfer is pending acknowledgment.',
            );
        }

        if ($doc->current_office_id !== $actor->office_id && $actor->role !== 'records_officer') {
            throw new ApiDomainException(
                'CUSTODY_REQUIRED',
                'Only the office currently holding this document (or Records Officer) can mark it Approved or Archived.',
                403,
            );
        }

        $cleanRemarks = trim($remarks);

        return DB::transaction(function () use ($actor, $doc, $targetStatus, $cleanRemarks, $deviceLabel): Document {
            $actor->loadMissing('office');
            $now = now();

            $doc->update([
                'lifecycle_status' => $targetStatus,
                'current_holder_id' => $actor->id,
            ]);
            $doc->participants()->syncWithoutDetaching([$actor->id]);

            $stageLabel = $targetStatus === 'approved'
                ? "Approved & Released by {$actor->office->code}"
                : "Archived by {$actor->office->code}";

            ExternalMilestone::query()->create([
                'id' => 'ms-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'stage_label' => $stageLabel,
                'office_name' => $actor->office->name,
                'occurred_at' => $now,
            ]);

            if ($doc->origin_user_id !== $actor->id) {
                $statusTitle = $targetStatus === 'approved'
                    ? "Document Approved & Released · {$doc->tracking_code}"
                    : "Document Archived · {$doc->tracking_code}";
                $detail = $cleanRemarks !== ''
                    ? "{$doc->title} — {$stageLabel}: {$cleanRemarks}"
                    : "{$doc->title} — {$stageLabel}.";

                $this->notifyRecipient(
                    $doc->origin_user_id,
                    $doc->origin_office_id,
                    $doc->id,
                    $statusTitle,
                    $detail,
                    'Document status updated in Tracely.',
                    "{$doc->tracking_code} · {$stageLabel}",
                    $now,
                );
            }

            $this->audit->record(
                $actor,
                $targetStatus === 'approved' ? 'approved_released' : 'archived',
                $doc->id,
                $doc->tracking_code,
                $cleanRemarks !== ''
                    ? "{$stageLabel} ({$doc->tracking_code}): {$cleanRemarks}"
                    : "{$stageLabel} ({$doc->tracking_code})",
                $deviceLabel,
            );

            $this->realtime->publish(
                $targetStatus === 'approved' ? 'document_approved' : 'document_archived',
                [$actor->office_id, $doc->origin_office_id, $doc->current_office_id],
                [$actor->id, $doc->origin_user_id],
                $doc->id,
            );

            return $doc->fresh();
        });
    }

    /**
     * Lists document thread comments visible to the signed-in actor (hiding other offices' internal_office notes).
     *
     * @return Collection<int, DocumentComment>
     */
    public function listComments(User $actor, Document $doc): Collection
    {
        $doc->loadMissing(['participants', 'transactions', 'comments']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->isSealedForActor($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Scan the routing QR code to unlock this document before reading notes.',
                403,
            );
        }

        return $doc->comments
            ->filter(fn (DocumentComment $comment): bool => $comment->isVisibleTo($actor))
            ->values();
    }

    public function addComment(
        User $actor,
        Document $doc,
        string $body,
        string $visibility,
        string $deviceLabel,
    ): DocumentComment {
        $doc->loadMissing(['participants', 'transactions', 'originOffice']);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->isSealedForActor($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Scan the routing QR code to unlock this document before posting notes.',
                403,
            );
        }

        $cleanBody = trim($body);
        if ($cleanBody === '') {
            throw new ApiDomainException('EMPTY_COMMENT', 'Comment body cannot be empty.');
        }

        $safeVisibility = $visibility === 'internal_office' ? 'internal_office' : 'cross_office';

        return DB::transaction(function () use ($actor, $doc, $cleanBody, $safeVisibility, $deviceLabel): DocumentComment {
            $actor->loadMissing('office');
            $now = now();

            $comment = DocumentComment::query()->create([
                'id' => 'cmt-'.Str::uuid()->toString(),
                'document_id' => $doc->id,
                'author_id' => $actor->id,
                'author_name' => $actor->full_name,
                'author_office_id' => $actor->office_id,
                'author_office_code' => $actor->office?->code ?? 'HQ',
                'author_position' => $actor->position ?? '',
                'visibility' => $safeVisibility,
                'body' => $cleanBody,
            ]);

            $targetOfficeIds = [$actor->office_id];
            $targetUserIds = [$actor->id];

            if ($safeVisibility === 'cross_office') {
                $targetOfficeIds[] = $doc->origin_office_id;
                $targetOfficeIds[] = $doc->current_office_id;

                $notifyUserIds = array_values(array_unique(array_filter([
                    $doc->origin_user_id,
                    $doc->current_holder_id,
                ], fn (?string $uid): bool => $uid !== null && $uid !== $actor->id)));

                foreach ($notifyUserIds as $uid) {
                    $recipientUser = User::query()->find($uid);
                    if (! $recipientUser) {
                        continue;
                    }
                    $targetUserIds[] = $recipientUser->id;
                    $this->notifyRecipient(
                        $recipientUser->id,
                        $recipientUser->office_id,
                        $doc->id,
                        "New Note · {$doc->tracking_code}",
                        "{$actor->full_name} ({$actor->office->code}) commented on {$doc->title}: ".Str::limit($cleanBody, 140),
                        'You have 1 new note on a document.',
                        "{$doc->tracking_code} note from {$actor->office->code}",
                        $now,
                    );
                }
            }

            $this->audit->record(
                $actor,
                'comment_posted',
                $doc->id,
                $doc->tracking_code,
                $safeVisibility === 'internal_office'
                    ? "Posted internal {$actor->office->code} note on {$doc->tracking_code}"
                    : "Posted cross-office note on {$doc->tracking_code}",
                $deviceLabel,
            );

            $this->realtime->publish(
                'document_comment',
                $targetOfficeIds,
                $targetUserIds,
                $doc->id,
            );

            return $comment;
        });
    }

    private function resolveStoredFileName(UploadedFile $file, ?string $customFileName, string $fallback): string
    {
        $originalName = trim((string) ($file->getClientOriginalName() ?: $fallback));
        $ext = strtolower((string) ($file->getClientOriginalExtension() ?: $file->guessExtension() ?: pathinfo($fallback, PATHINFO_EXTENSION)));
        $rawCandidate = trim((string) ($customFileName ?? ''));
        if ($rawCandidate === '') {
            $rawCandidate = $originalName;
        }

        // Strip URL query/fragment before decoding so encoded `#` (%23) inside filenames is preserved
        $decoded = preg_match('/^[a-z][a-z0-9+.-]*:\/\//i', $rawCandidate)
            ? (preg_replace('/[?#].*$/', '', $rawCandidate) ?? $rawCandidate)
            : $rawCandidate;

        // Safely decode URI-encoded filenames (e.g. %20 or Android content:// primary%3ADocuments%2F...)
        for ($pass = 0; $pass < 2; $pass++) {
            $next = rawurldecode($decoded);
            if ($next === $decoded || ! mb_check_encoding($next, 'UTF-8')) {
                break;
            }
            $decoded = $next;
        }

        // Strip directory segments and Android provider prefixes (primary:, raw:, msf:)
        $normalizedSlashes = str_replace('\\', '/', $decoded);
        $base = basename($normalizedSlashes);
        $base = preg_replace('/^(?:primary|home|raw|document|msf|downloads):/i', '', $base) ?? $base;
        $base = basename(str_replace('\\', '/', $base));

        // Strip control chars and invalid filesystem punctuation
        $clean = preg_replace('/[\x00-\x1F\x7F:*?"<>|\/\\\\]+/', ' ', $base) ?? '';
        $clean = trim(preg_replace('/\s+/', ' ', $clean) ?? '', ". \t\n\r\0\x0B");
        if ($clean === '') {
            $clean = $fallback;
        }

        if ($ext !== '' && ! str_ends_with(strtolower($clean), ".{$ext}")) {
            $clean .= ".{$ext}";
        }

        if (mb_strlen($clean) > 180) {
            $suffix = $ext !== '' ? ".{$ext}" : '';
            $stemLimit = max(1, 180 - mb_strlen($suffix));
            $stem = $suffix !== '' && str_ends_with(strtolower($clean), $suffix)
                ? mb_substr($clean, 0, mb_strlen($clean) - mb_strlen($suffix))
                : $clean;
            $clean = rtrim(mb_substr($stem, 0, $stemLimit)).$suffix;
        }

        return $clean;
    }

    private function createDispatchTransaction(
        User $actor,
        Document $doc,
        User $recipient,
        string $remarks,
        Carbon $now,
    ): RoutingTransaction {
        $recipient->loadMissing('office');
        $isInternal = $actor->office_id === $recipient->office_id;
        $scope = $isInternal ? 'internal_office' : 'inter_office';

        $tx = RoutingTransaction::query()->create([
            'id' => 'tx-'.Str::uuid()->toString(),
            'document_id' => $doc->id,
            'from_user_id' => $actor->id,
            'from_office_id' => $actor->office_id,
            'to_user_id' => $recipient->id,
            'to_office_id' => $recipient->office_id,
            'routing_scope' => $scope,
            'receipt_status' => 'pending',
            'remarks' => trim($remarks) ?: 'Forwarded for appropriate action.',
            'is_internal_only' => $isInternal,
            'sent_at' => $now,
        ]);

        ExternalMilestone::query()->create([
            'id' => 'ms-'.Str::uuid()->toString(),
            'document_id' => $doc->id,
            'stage_label' => $isInternal
                ? "Internal Desk · {$recipient->office->code}"
                : "Routed to {$recipient->office->code}",
            'office_name' => $recipient->office->name,
            'occurred_at' => $now,
        ]);

            $this->notifyRecipient(
                $recipient->id,
                $recipient->office_id,
                $doc->id,
                "Sealed QR Incoming · From {$actor->office->code}",
                "{$actor->office->code} ({$actor->full_name}) sent a sealed document transfer. Tap to open the QR Scanner and scan the sender's routing QR code to unlock and access it.",
                'New sealed QR transfer waiting to be scanned in Tracely.',
                "Sealed transfer from {$actor->office->code} · Scan sender's routing QR to unlock",
                $now,
            );

            $this->realtime->publish(
                'document_dispatched',
                [$actor->office_id, $recipient->office_id],
                [$actor->id, $recipient->id],
                $doc->id,
            );

            return $tx;
    }

    private function assertValidQrVerificationCode(Document $doc, ?string $rawCode): void
    {
        $clean = trim((string) ($rawCode ?? ''));
        foreach (['TRC-QR:DOC:', 'TRC-QR:VERIFY:', 'SDO-QR:DOC:', 'SDO-QR:VERIFY:'] as $prefix) {
            if (stripos($clean, $prefix) === 0) {
                $clean = trim(substr($clean, strlen($prefix)));
            }
        }

        if ($clean === '') {
            throw new ApiDomainException(
                'QR_VERIFICATION_REQUIRED',
                'Scan the sender\'s routing QR code or enter the code from the routing slip to unlock and confirm receipt.',
                422,
            );
        }

        $matchesQrToken = $doc->qr_token !== ''
            && hash_equals(strtolower($doc->qr_token), strtolower($clean));
        $matchesTrackingCode = $doc->tracking_code !== ''
            && hash_equals(strtoupper($doc->tracking_code), strtoupper($clean));

        if (! $matchesQrToken && ! $matchesTrackingCode) {
            throw new ApiDomainException(
                'QR_VERIFICATION_MISMATCH',
                'The scanned QR code or tracking code does not match this pending document transfer.',
                422,
            );
        }
    }

    private function notifyRecipient(
        string $targetUserId,
        string $targetOfficeId,
        string $documentId,
        string $title,
        string $content,
        string $lockScreenPreview,
        string $authenticatedDetail,
        Carbon $now,
    ): void {
        UserNotification::query()->create([
            'id' => 'notif-'.Str::uuid()->toString(),
            'target_user_id' => $targetUserId,
            'target_office_id' => $targetOfficeId,
            'document_id' => $documentId,
            'title' => Str::limit($title, 185, ''),
            'content' => Str::limit($content, 1000, ''),
            'lock_screen_preview' => Str::limit($lockScreenPreview, 185, ''),
            'authenticated_detail' => Str::limit($authenticatedDetail, 250, ''),
            'received_at' => $now,
            'read' => false,
        ]);

        $this->realtime->publish(
            'notification_created',
            [$targetOfficeId],
            [$targetUserId],
            $documentId,
            $lockScreenPreview,
        );
    }

    private function nextTrackingCode(): string
    {
        $year = now()->format('Y');
        $prefix = "TRC-{$year}-";
        $latest = Document::query()
            ->where('tracking_code', 'like', "{$prefix}%")
            ->orderByDesc('tracking_code')
            ->value('tracking_code');

        $nextNumber = 143;
        if (is_string($latest) && preg_match('/(\d+)$/', $latest, $m)) {
            $nextNumber = max(143, ((int) $m[1]) + 1);
        }

        while (Document::query()->where('tracking_code', $prefix.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT))->exists()) {
            $nextNumber++;
        }

        return $prefix.str_pad((string) $nextNumber, 6, '0', STR_PAD_LEFT);
    }

    private function computeSlaDueAt(string $tier, ?DocumentCategory $category = null): Carbon
    {
        if ($category) {
            $category->loadMissing('slaPolicy');
            if ($category->slaPolicy && $category->slaPolicy->active && $category->slaPolicy->target_hours > 0) {
                return now()->addHours($category->slaPolicy->target_hours);
            }
        }

        $hours = match ($tier) {
            'confidential' => 24,
            'restricted' => 36,
            default => 48,
        };

        return now()->addHours($hours);
    }
}
