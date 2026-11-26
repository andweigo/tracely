<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiDomainException;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentComment;
use App\Models\DocumentVersion;
use App\Models\RoutingTransaction;
use App\Models\User;
use App\Services\AccessPolicyService;
use App\Services\AuditLogger;
use App\Services\DocumentWorkflowService;
use App\Support\DtoSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

class DocumentController extends Controller
{
    public function __construct(
        private readonly AccessPolicyService $policy,
        private readonly DocumentWorkflowService $workflow,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $query = Document::query()
            ->with([
                'category',
                'originOffice',
                'originUser',
                'currentOffice',
                'currentHolder',
                'submittedSchool',
                'participants',
                'versions.uploadedBy',
                'transactions.fromUser',
                'transactions.toUser',
                'transactions.fromOffice',
                'transactions.toOffice',
                'externalMilestones',
            ])
            ->orderByDesc('created_at');

        $status = trim((string) $request->query('status', ''));
        if ($status !== '' && in_array($status, ['registered', 'in_transit', 'in_review', 'returned_for_revision', 'approved', 'archived'], true)) {
            $query->where('lifecycle_status', $status);
        }

        $copyFormat = trim((string) $request->query('copy_format', ''));
        if ($copyFormat !== '' && in_array($copyFormat, ['digital', 'hard_copy', 'hybrid'], true)) {
            $query->where('copy_format', $copyFormat);
        }

        $categoryId = trim((string) $request->query('category_id', ''));
        if ($categoryId !== '') {
            $query->where('category_id', $categoryId);
        }

        $search = mb_strtolower(trim((string) $request->query('q', '')));

        $docs = $query
            ->get()
            ->filter(fn (Document $doc): bool => $this->policy->authorizeFullCustody($actor, $doc)['allowed'])
            ->map(fn (Document $doc) => DtoSerializer::document($doc, $actor, $this->policy));

        if ($search !== '') {
            $docs = $docs->filter(function (array $dto) use ($search): bool {
                $haystack = mb_strtolower(implode(' ', [
                    (string) ($dto['tracking_code'] ?? ''),
                    (string) ($dto['title'] ?? ''),
                    (string) ($dto['category_name'] ?? ''),
                    (string) ($dto['origin_office']['code'] ?? ''),
                    (string) ($dto['current_office']['code'] ?? ''),
                ]));

                return str_contains($haystack, $search);
            });
        }

        $docs = $docs->values();
        $perPageRaw = $request->query('per_page');
        if ($perPageRaw !== null && is_numeric($perPageRaw) && (int) $perPageRaw > 0) {
            $perPage = max(1, min(100, (int) $perPageRaw));
            $total = $docs->count();
            $lastPage = max(1, (int) ceil($total / $perPage));
            $page = max(1, min($lastPage, (int) $request->query('page', 1)));
            $slice = $docs->slice(($page - 1) * $perPage, $perPage)->values()->all();

            return response()->json([
                'data' => $slice,
                'meta' => [
                    'current_page' => $page,
                    'last_page' => $lastPage,
                    'per_page' => $perPage,
                    'total' => $total,
                ],
            ]);
        }

        return response()->json([
            'data' => $docs->all(),
        ]);
    }

    public function tracked(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $docs = Document::query()
            ->with([
                'category',
                'originOffice',
                'currentOffice',
                'currentHolder',
                'participants',
                'versions',
                'transactions.fromOffice',
                'transactions.toOffice',
                'externalMilestones',
            ])
            ->orderByDesc('created_at')
            ->get();

        $snapshots = [];
        foreach ($docs as $doc) {
            if (! $doc->involvesOffice($actor->office_id) && $actor->role !== 'records_officer') {
                continue;
            }
            $snap = DtoSerializer::trackingSnapshot($actor, $doc, $this->policy);
            if ($snap !== null) {
                $snapshots[] = $snap;
            }
        }

        return response()->json(['data' => $snapshots]);
    }

    public function trackByCode(string $code, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $clean = strtoupper(trim($code));

        $doc = Document::query()
            ->with([
                'category',
                'originOffice',
                'currentOffice',
                'currentHolder',
                'participants',
                'versions',
                'transactions.fromOffice',
                'transactions.toOffice',
                'externalMilestones',
            ])
            ->whereRaw('UPPER(tracking_code) = ?', [$clean])
            ->first();

        if (! $doc) {
            return response()->json(['data' => null]);
        }

        return response()->json([
            'data' => DtoSerializer::trackingSnapshot($actor, $doc, $this->policy),
        ]);
    }

    public function show(string $id, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);
        $this->policy->enforceFullCustody($actor, $doc);

        return response()->json([
            'data' => DtoSerializer::document($doc, $actor, $this->policy),
        ]);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'min:3', 'max:240'],
            'category_id' => ['sometimes', 'string', 'max:64'],
            'confidentiality_tier' => ['sometimes', 'in:standard_internal,restricted,confidential'],
            'physical_reference' => ['nullable', 'string', 'max:120'],
            'physical_page_count' => ['nullable', 'integer', 'min:1', 'max:5000'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);
        $updated = $this->workflow->updateDocumentDetails(
            $actor,
            $doc,
            $validated,
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json([
            'data' => DtoSerializer::document($updated),
        ]);
    }

    public function storeDigital(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:140'],
            'category_id' => ['required', 'string', 'max:64'],
            'confidentiality_tier' => ['required', 'in:standard_internal,restricted,confidential'],
            'file_name' => ['nullable', 'string', 'min:1', 'max:180'],
            'change_type' => ['nullable', 'in:initial,signed,revised,endorsed,supporting_attachment'],
            'sha256_checksum' => ['nullable', 'string', 'size:64', 'regex:/^[0-9a-fA-F]{64}$/'],
            'size_bytes' => ['nullable', 'integer', 'min:1'],
            'recipient_user_id' => ['nullable', 'string', 'max:64'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'route_to_delegate_if_on_leave' => ['nullable'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:25600'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $validated['route_to_delegate_if_on_leave'] = filter_var(
            $request->input('route_to_delegate_if_on_leave', false),
            FILTER_VALIDATE_BOOLEAN,
        );

        $doc = $this->workflow->createDigitalDocument(
            $actor,
            $validated,
            $request->file('file'),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($doc)], 201);
    }

    public function storeHardCopy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:140'],
            'category_id' => ['required', 'string', 'max:64'],
            'confidentiality_tier' => ['required', 'in:standard_internal,restricted,confidential'],
            'physical_reference' => ['nullable', 'string', 'max:80'],
            'physical_page_count' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'recipient_user_id' => ['nullable', 'string', 'max:64'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'route_to_delegate_if_on_leave' => ['nullable', 'boolean'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = $this->workflow->registerHardCopyDocument(
            $actor,
            $validated,
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($doc)], 201);
    }

    public function acknowledge(string $id, Request $request): JsonResponse
    {
        $request->validate([
            'sha256_checksum' => ['nullable', 'string', 'size:64', 'regex:/^[0-9a-fA-F]{64}$/'],
            'exif_stripped' => ['nullable'],
            'proof_photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
            'verification_code' => ['nullable', 'string', 'max:180'],
            'qr_token' => ['nullable', 'string', 'max:180'],
            'password' => ['nullable', 'string', 'min:1', 'max:128'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);
        $verificationCode = $request->input('verification_code') ?? $request->input('qr_token');
        $password = $request->input('password');

        $updated = $this->workflow->acknowledge(
            $actor,
            $doc,
            $request->file('proof_photo'),
            $request->input('sha256_checksum'),
            filter_var($request->input('exif_stripped', true), FILTER_VALIDATE_BOOLEAN),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
            is_string($verificationCode) ? $verificationCode : null,
            is_string($password) ? $password : null,
        );

        return response()->json(['data' => DtoSerializer::document($updated, $actor, $this->policy)]);
    }

    public function createUnlockChallenge(string $id, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);
        $challenge = $this->workflow->createUnlockChallenge($actor, $doc);
        $reused = ! $challenge->wasRecentlyCreated;
        $ttlSeconds = max(0, (int) now()->diffInSeconds($challenge->expires_at, false));

        return response()->json([
            'challenge_id' => $challenge->id,
            'document_id' => $challenge->document_id,
            'token' => $challenge->token,
            'qr_payload' => "TRC-QR:UNLOCK:{$challenge->token}",
            'short_code' => $challenge->formattedShortCode(),
            'expires_at' => $challenge->expires_at->toIso8601String(),
            'ttl_seconds' => $ttlSeconds,
            'reused' => $reused,
        ], $reused ? 200 : 201);
    }

    public function forward(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_user_id' => ['required', 'string', 'max:64'],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'route_to_delegate_if_on_leave' => ['nullable', 'boolean'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->forward(
            $actor,
            $doc,
            $validated['recipient_user_id'],
            (string) ($validated['remarks'] ?? ''),
            (bool) ($validated['route_to_delegate_if_on_leave'] ?? false),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($updated)]);
    }

    public function recall(string $id, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->recall(
            $actor,
            $doc,
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($updated)]);
    }

    public function decline(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:1', 'max:1000'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->decline(
            $actor,
            $doc,
            $validated['reason'],
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($updated)]);
    }

    public function returnForRevision(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'remarks' => ['required', 'string', 'min:1', 'max:1000'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->returnForRevision(
            $actor,
            $doc,
            $validated['remarks'],
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($updated)]);
    }

    public function uploadRevision(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'revision_note' => ['nullable', 'string', 'max:500'],
            'file_name' => ['nullable', 'string', 'min:1', 'max:180'],
            'change_type' => ['nullable', 'in:initial,signed,revised,endorsed,supporting_attachment'],
            'sha256_checksum' => ['nullable', 'string', 'size:64', 'regex:/^[0-9a-fA-F]{64}$/'],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:25600'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->uploadRevisionVersion(
            $actor,
            $doc,
            $request->file('file'),
            $validated['sha256_checksum'] ?? null,
            (string) ($validated['revision_note'] ?? ''),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
            $validated['file_name'] ?? null,
            $validated['change_type'] ?? null,
        );

        return response()->json(['data' => DtoSerializer::document($updated, $actor, $this->policy)]);
    }

    public function presignedUrl(string $id, int $versionNumber, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->with(['versions.uploadedBy', 'participants', 'transactions'])->findOrFail($id);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->requiresReceiptBeforeFileAccess($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Scan the routing QR code or enter the document tracking code to confirm receipt before viewing or accessing this document.',
                403,
            );
        }

        $version = $doc->versions->firstWhere('version_number', $versionNumber);
        if (! $version) {
            throw new ApiDomainException('VERSION_NOT_FOUND', "Version v{$versionNumber} was not found.", 404);
        }

        $ttlSeconds = 60;
        $expiresAt = now()->addSeconds($ttlSeconds);
        $relativeSignedPath = URL::temporarySignedRoute(
            'api.v1.documents.stream',
            $expiresAt,
            ['id' => $doc->id, 'versionNumber' => $versionNumber],
            absolute: false,
        );
        $url = rtrim($request->getSchemeAndHttpHost(), '/').$relativeSignedPath;

        $this->audit->record(
            $actor,
            'presigned_url_issued',
            $doc->id,
            $doc->tracking_code,
            "Issued 60s viewing grant for {$doc->tracking_code} v{$versionNumber}",
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json([
            'url' => $url,
            'expires_at' => $expiresAt->toIso8601String(),
            'ttl_seconds' => $ttlSeconds,
            'version' => DtoSerializer::version($version),
        ]);
    }

    public function streamVersion(string $id, int $versionNumber, Request $request): Response
    {
        if (! $request->hasValidRelativeSignature()) {
            return response()->json([
                'code' => 'SIGNED_URL_EXPIRED',
                'message' => 'Signed document link is invalid or has expired. Request a new link from Tracely.',
            ], 403);
        }

        $version = DocumentVersion::query()
            ->where('document_id', $id)
            ->where('version_number', $versionNumber)
            ->first();

        if (! $version || ! Storage::disk('local')->exists($version->storage_key)) {
            return response()->json([
                'code' => 'FILE_NOT_FOUND',
                'message' => 'Document file version was not found in private storage.',
            ], 404);
        }

        $safeName = str_replace(['"', "\r", "\n", '\\', '/'], '_', trim((string) $version->file_name));
        if ($safeName === '') {
            $safeName = "document_v{$versionNumber}";
        }

        $mime = $version->mime_type ?: (Storage::disk('local')->mimeType($version->storage_key) ?: 'application/octet-stream');

        return Storage::disk('local')->response(
            $version->storage_key,
            $safeName,
            [
                'Content-Type' => $mime,
                'Cache-Control' => 'private, no-store, max-age=0',
                'X-Content-Type-Options' => 'nosniff',
            ],
            'inline',
        );
    }

    public function complete(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:approved,archived'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $updated = $this->workflow->completeDocument(
            $actor,
            $doc,
            $validated['status'],
            (string) ($validated['remarks'] ?? ''),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::document($updated)]);
    }

    public function comments(string $id, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $items = $this->workflow->listComments($actor, $doc);

        return response()->json([
            'data' => $items->map(fn (DocumentComment $c) => DtoSerializer::comment($c))->values()->all(),
        ]);
    }

    public function storeComment(string $id, Request $request): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:1000'],
            'visibility' => ['nullable', 'in:cross_office,internal_office'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->findOrFail($id);

        $comment = $this->workflow->addComment(
            $actor,
            $doc,
            $validated['body'],
            (string) ($validated['visibility'] ?? 'cross_office'),
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json(['data' => DtoSerializer::comment($comment)], 201);
    }

    public function proofPhotoUrl(string $id, string $transactionId, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->with(['participants', 'transactions'])->findOrFail($id);
        $this->policy->enforceFullCustody($actor, $doc);

        if ($this->policy->requiresReceiptBeforeFileAccess($actor, $doc)) {
            throw new ApiDomainException(
                'RECEIPT_REQUIRED_BEFORE_ACCESS',
                'Scan the routing QR code or enter the document tracking code to confirm receipt before viewing attached proof files.',
                403,
            );
        }

        /** @var RoutingTransaction|null $tx */
        $tx = $doc->transactions->firstWhere('id', $transactionId);
        if (! $tx || ! $tx->proof_photo_storage_key || ! $tx->proof_photo_file_name) {
            throw new ApiDomainException('PROOF_NOT_FOUND', 'No receive-proof photo is attached to this transfer.', 404);
        }

        $ttlSeconds = 60;
        $expiresAt = now()->addSeconds($ttlSeconds);
        $relativeSignedPath = URL::temporarySignedRoute(
            'api.v1.documents.proof-stream',
            $expiresAt,
            ['id' => $doc->id, 'transactionId' => $tx->id],
            absolute: false,
        );
        $url = rtrim($request->getSchemeAndHttpHost(), '/').$relativeSignedPath;

        $ext = strtolower(pathinfo($tx->proof_photo_file_name, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'image/jpeg',
        };

        $this->audit->record(
            $actor,
            'presigned_url_issued',
            $doc->id,
            $doc->tracking_code,
            "Issued 60s viewing grant for receive-proof photo ({$tx->id})",
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        return response()->json([
            'url' => $url,
            'expires_at' => $expiresAt->toIso8601String(),
            'ttl_seconds' => $ttlSeconds,
            'version' => [
                'id' => $tx->id,
                'version_number' => 0,
                'file_name' => $tx->proof_photo_file_name,
                'mime_type' => $mime,
                'size_bytes' => (int) ($tx->proof_photo_compressed_bytes ?? 0),
                'sha256_checksum' => $tx->proof_photo_sha256 ?? '',
                'uploaded_by_id' => $tx->to_user_id,
                'uploaded_by_name' => $tx->acknowledged_by_name ?? 'Receiving Officer',
                'uploaded_at' => ($tx->proof_photo_captured_at ?? $tx->acknowledged_at ?? $tx->sent_at)->toIso8601String(),
                'revision_note' => 'Signed slip receive-proof photo (EXIF stripped)',
            ],
        ]);
    }

    public function streamProofPhoto(string $id, string $transactionId, Request $request): Response
    {
        if (! $request->hasValidRelativeSignature()) {
            return response()->json([
                'code' => 'SIGNED_URL_EXPIRED',
                'message' => 'Signed proof-photo link is invalid or has expired.',
            ], 403);
        }

        $tx = RoutingTransaction::query()
            ->where('document_id', $id)
            ->where('id', $transactionId)
            ->first();

        if (! $tx || ! $tx->proof_photo_storage_key || ! Storage::disk('local')->exists($tx->proof_photo_storage_key)) {
            return response()->json([
                'code' => 'PROOF_NOT_FOUND',
                'message' => 'Receive-proof photo was not found in private storage.',
            ], 404);
        }

        $safeName = str_replace(['"', "\r", "\n", '\\', '/'], '_', trim((string) ($tx->proof_photo_file_name ?: 'receipt_proof.jpg')));
        $mime = Storage::disk('local')->mimeType($tx->proof_photo_storage_key) ?: 'image/jpeg';

        return Storage::disk('local')->response(
            $tx->proof_photo_storage_key,
            $safeName,
            [
                'Content-Type' => $mime,
                'Cache-Control' => 'private, no-store, max-age=0',
                'X-Content-Type-Options' => 'nosniff',
            ],
            'inline',
        );
    }
}
