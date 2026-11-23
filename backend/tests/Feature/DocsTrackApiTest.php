<?php

namespace Tests\Feature;

use App\Models\Document;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class DocsTrackApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(DatabaseSeeder::class);
    }

    private function asToken(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function fakePng(string $name = 'proof.png'): UploadedFile
    {
        // Minimal 1x1 transparent PNG
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        );

        return UploadedFile::fake()->createWithContent($name, $png);
    }

    private function loginAs(string $identifier, string $device = 'Pixel Test'): string
    {
        $this->app['auth']->forgetGuards();
        $res = $this->postJson('/api/v1/auth/login', [
            'identifier' => $identifier,
            'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
            'device_name' => $device,
        ]);

        $res->assertOk();
        $res->assertJsonStructure(['token', 'bearer_token', 'expires_at', 'user' => ['id', 'office']]);

        return (string) $res->json('token');
    }

    public function test_health_login_registration_sessions_and_availability(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJson(['status' => 'ok', 'database' => 'sqlite']);

        $token1 = $this->loginAs('TRC-0204', 'Android Field Unit');
        $token2 = $this->loginAs('budget@tracely.app', 'Tracely Web');

        $this->asToken($token2)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.id', 'usr-budget-1');

        $this->asToken($token2)
            ->getJson('/api/v1/auth/sessions')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->asToken($token2)
            ->postJson('/api/v1/auth/sessions/revoke-others')
            ->assertOk()
            ->assertJson(['revoked_count' => 1]);

        $this->assertNotEmpty($token1);

        $this->asToken($token2)
            ->patchJson('/api/v1/personnel/availability', [
                'availability' => 'official_business',
                'delegate_id' => 'usr-sgod-1',
            ])
            ->assertOk()
            ->assertJsonPath('data.availability', 'official_business')
            ->assertJsonPath('data.delegate_id', 'usr-sgod-1');

        // Self-registration enters pending approval queue and cannot log in until approved
        $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Ana Clara Dizon',
            'employee_id' => 'TRC-9910',
            'email' => 'ana.dizon@tracely.app',
            'position' => 'Administrative Aide VI',
            'office_code' => 'OPS',
            'password' => 'Str0ng!Pass2026',
        ])
            ->assertCreated()
            ->assertJsonPath('pending_approval', true);

        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'TRC-9910',
            'password' => 'Str0ng!Pass2026',
        ])->assertStatus(403);
    }

    public function test_digital_bundle_checksum_verification_presigned_download_and_routing(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app');
        $sgodToken = $this->loginAs('ops@tracely.app');

        $pdf1 = UploadedFile::fake()->createWithContent('memo_1.pdf', "%PDF-1.4\nPage1\n%%EOF");
        $validSha1 = hash('sha256', "%PDF-1.4\nPage1\n%%EOF");

        // Reject tampered SHA-256
        $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'Tampered Checksum Test',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'sha256_checksum' => str_repeat('0', 64),
                'file' => $pdf1,
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'CHECKSUM_MISMATCH');

        // Upload held locally with custom renamed file_name, attach page 2 bundle file with renamed file_name, then forward
        $createRes = $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'Region IV-A Bundle Endorsement',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'file_name' => 'Region_IVA_Endorsement_Signed',
                'sha256_checksum' => $validSha1,
                'size_bytes' => strlen("%PDF-1.4\nPage1\n%%EOF"),
                'file' => $pdf1,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $docId = (string) $createRes->json('data.id');
        $docQrToken = (string) $createRes->json('data.qr_token');
        $this->assertSame('in_review', $createRes->json('data.lifecycle_status'));
        $this->assertSame('Region_IVA_Endorsement_Signed.pdf', $createRes->json('data.versions.0.file_name'));

        $pdf2 = UploadedFile::fake()->createWithContent('annex_2.pdf', "%PDF-1.4\nPage2\n%%EOF");
        $validSha2 = hash('sha256', "%PDF-1.4\nPage2\n%%EOF");

        $bundleRes = $this->asToken($budgetToken)
            ->post("/api/v1/documents/{$docId}/versions", [
                'revision_note' => 'Supporting attachment (2 of 2)',
                'file_name' => 'Budget_Annex_B.pdf',
                'sha256_checksum' => $validSha2,
                'file' => $pdf2,
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $this->assertCount(2, $bundleRes->json('data.versions'));
        $this->assertSame('Budget_Annex_B.pdf', $bundleRes->json('data.versions.1.file_name'));

        $this->asToken($budgetToken)
            ->postJson("/api/v1/documents/{$docId}/forward", [
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'For SGOD evaluation',
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'in_transit')
            ->assertJsonPath('data.current_office.code', 'OPS');

        // SGOD acknowledges with scanned QR token, then Budget cannot recall after ack
        $proof = $this->fakePng('proof.png');
        $this->asToken($sgodToken)
            ->post("/api/v1/documents/{$docId}/acknowledge", [
                'verification_code' => $docQrToken,
                'proof_photo' => $proof,
                'exif_stripped' => '1',
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'in_review')
            ->assertJsonPath('data.is_sealed', false);

        $this->asToken($budgetToken)
            ->postJson("/api/v1/documents/{$docId}/recall")
            ->assertStatus(422)
            ->assertJsonPath('code', 'RECALL_NOT_ALLOWED');

        // Presigned temporary URL streams inline with relative-signature validation and no-store headers
        $grantRes = $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/versions/1/presigned-url")
            ->assertOk()
            ->assertJsonStructure(['url', 'expires_at', 'ttl_seconds', 'version']);

        $signedUrl = (string) $grantRes->json('url');
        $this->assertStringContainsString("/api/v1/documents/{$docId}/versions/1/stream", $signedUrl);
        Storage::disk('local')->assertExists("docs/{$docId}/v1.pdf");

        $parsed = parse_url($signedUrl);
        $relativeSigned = ($parsed['path'] ?? '').(isset($parsed['query']) ? '?'.$parsed['query'] : '');
        $fileRes = $this->get($relativeSigned);
        $fileRes->assertOk();
        $this->assertStringContainsString('no-store', (string) $fileRes->headers->get('Cache-Control'));
        $this->assertStringContainsString('inline', (string) $fileRes->headers->get('Content-Disposition'));
        $this->assertStringContainsString('Region_IVA_Endorsement_Signed.pdf', (string) $fileRes->headers->get('Content-Disposition'));

        // Unsigned or tampered stream link must be rejected with 403
        $this->get("/api/v1/documents/{$docId}/versions/1/stream")
            ->assertStatus(403)
            ->assertJsonPath('code', 'SIGNED_URL_EXPIRED');
    }

    public function test_leave_delegate_routing_decline_and_return_for_revision_flow(): void
    {
        $recordsToken = $this->loginAs('records@tracely.app');
        $budgetHeadToken = $this->loginAs('budget@tracely.app');
        $legalToken = $this->loginAs('legal@tracely.app');

        // usr-budget-2 (Teresa) is seeded on_leave with delegate usr-budget-1 (Marco)
        $pdf1 = UploadedFile::fake()->createWithContent('mooe_req.pdf', "%PDF-1.4\nInitial\n%%EOF");
        $docRes = $this->asToken($recordsToken)
            ->post('/api/v1/documents', [
                'title' => 'Leave Delegate Auto-Route Test',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-budget-2',
                'route_to_delegate_if_on_leave' => '1',
                'file' => $pdf1,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $docId = (string) $docRes->json('data.id');
        $trackingCode = (string) $docRes->json('data.tracking_code');
        $docQrToken = (string) $docRes->json('data.qr_token');
        $this->assertSame('usr-budget-1', $docRes->json('data.current_holder_id'));

        // Delegate declines misrouted document without needing to unlock contents -> returns to origin (Records)
        $this->asToken($budgetHeadToken)
            ->postJson("/api/v1/documents/{$docId}/decline", [
                'reason' => 'Missing Annex B schedule',
            ])
            ->assertOk()
            ->assertJsonPath('data.current_holder_id', 'usr-records-1')
            ->assertJsonPath('data.lifecycle_status', 'in_review');

        // Records forwards to Legal -> Legal scans QR to unlock, then returns for revision -> Records uploads v2
        $this->asToken($recordsToken)
            ->postJson("/api/v1/documents/{$docId}/forward", [
                'recipient_user_id' => 'usr-legal-1',
                'remarks' => 'For Legal clearance',
            ])
            ->assertOk();

        // Legal cannot return for revision while document is still sealed (unscanned)
        $this->asToken($legalToken)
            ->postJson("/api/v1/documents/{$docId}/return-revision", [
                'remarks' => 'Attempt before scanning',
            ])
            ->assertStatus(403)
            ->assertJsonPath('code', 'RECEIPT_REQUIRED_BEFORE_ACCESS');

        $this->asToken($legalToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge", [
                'verification_code' => $docQrToken,
            ])
            ->assertOk();

        $this->asToken($legalToken)
            ->postJson("/api/v1/documents/{$docId}/return-revision", [
                'remarks' => 'Attach notarized certification',
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'returned_for_revision')
            ->assertJsonPath('data.current_office.code', 'RECORDS');

        $pdf2 = UploadedFile::fake()->createWithContent('mooe_req_v2.pdf', "%PDF-1.4\nRevised\n%%EOF");
        $this->asToken($recordsToken)
            ->post("/api/v1/documents/{$docId}/versions", [
                'revision_note' => 'Attached notarized certification',
                'file' => $pdf2,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonCount(2, 'data.versions')
            ->assertJsonPath('data.lifecycle_status', 'in_review');

        $this->asToken($legalToken)
            ->getJson("/api/v1/documents/track/{$trackingCode}")
            ->assertOk()
            ->assertJsonPath('data.tracking_code', $trackingCode)
            ->assertJsonPath('data.visibility', 'full_custody');

        // Notifications hold title + content, return unread_count, and support single mark-read
        $notifRes = $this->asToken($recordsToken)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => [
                        'id',
                        'document_id',
                        'title',
                        'content',
                        'lock_screen_preview',
                        'authenticated_detail',
                        'received_at',
                        'read',
                    ],
                ],
                'unread_count',
            ]);

        $firstNotif = $notifRes->json('data.0');
        $this->assertNotEmpty($firstNotif['title']);
        $this->assertNotEmpty($firstNotif['content']);
        $beforeUnread = (int) $notifRes->json('unread_count');
        $this->assertGreaterThan(0, $beforeUnread);

        $this->asToken($recordsToken)
            ->postJson("/api/v1/notifications/{$firstNotif['id']}/read")
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('unread_count', $beforeUnread - 1);
    }

    public function test_confidentiality_isolation_and_qr_pairing_and_categories(): void
    {
        $osdsToken = $this->loginAs('exec@tracely.app');
        $sgodToken = $this->loginAs('ops@tracely.app');
        $budgetToken = $this->loginAs('budget@tracely.app');

        // OSDS creates confidential hard-copy slip held locally
        $confRes = $this->asToken($osdsToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Confidential Administrative Investigation File',
                'category_id' => 'cat-2',
                'confidentiality_tier' => 'confidential',
                'physical_reference' => 'ENV-2026-09',
                'physical_page_count' => 14,
            ])
            ->assertCreated();

        $confDocId = (string) $confRes->json('data.id');
        $confCode = (string) $confRes->json('data.tracking_code');
        $confQr = (string) $confRes->json('data.qr_token');

        // Non-participant SGOD is blocked from details, QR resolution, and tracking lookup
        $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/{$confDocId}")
            ->assertStatus(403)
            ->assertJsonPath('code', 'CONFIDENTIAL_CUSTODY_DENIED');

        $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/track/{$confCode}")
            ->assertOk()
            ->assertJsonPath('data', null);

        $this->asToken($sgodToken)
            ->postJson('/api/v1/qr/resolve-document', ['token' => "TRC-QR:DOC:{$confQr}"])
            ->assertStatus(403)
            ->assertJsonPath('code', 'CONFIDENTIAL_CUSTODY_DENIED');

        // Desktop pair session is bound strictly to creator account
        $pairRes = $this->asToken($budgetToken)
            ->postJson('/api/v1/qr/desktop-pair', ['draft_label' => 'Budget QR Upload'])
            ->assertCreated();

        $pairToken = (string) $pairRes->json('pair_token');

        $this->asToken($sgodToken)
            ->postJson('/api/v1/qr/resolve-pair', ['token' => "TRC-QR:PAIR:{$pairToken}"])
            ->assertStatus(403)
            ->assertJsonPath('code', 'PAIR_USER_MISMATCH');

        $captureFile = $this->fakePng('scan_doc.png');
        $this->asToken($budgetToken)
            ->post('/api/v1/attachments/mobile-capture', [
                'target_type' => 'desktop_pair',
                'target_id' => $pairToken,
                'exif_stripped' => '1',
                'compressed_bytes' => 4200,
                'photo' => $captureFile,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $this->asToken($budgetToken)
            ->getJson("/api/v1/qr/desktop-pair/{$pairToken}/status")
            ->assertOk()
            ->assertJsonPath('attached', true)
            ->assertJsonPath('file_name', 'scan_doc.png');

        // Category duplicate protection
        $this->asToken($budgetToken)
            ->postJson('/api/v1/categories', ['name' => 'Quarterly IPCR Submission', 'code' => 'IPCR-Q'])
            ->assertCreated();

        $this->asToken($budgetToken)
            ->postJson('/api/v1/categories', ['name' => 'quarterly ipcr submission', 'code' => 'IPCR-DUP'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'DUPLICATE_CATEGORY');

        // Unauthenticated transmittal QR verify works with zero PII
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/qr/verify-transmittal', [
            'token' => 'TRC-QR:VERIFY:9f4a8b12c7e04a3d91f2a77c8d04142a',
        ])
            ->assertOk()
            ->assertJsonPath('tracking_code', 'TRC-2026-000142')
            ->assertJsonPath('current_office_name', 'Budget Unit');

        $this->assertTrue(Document::query()->where('id', $confDocId)->exists());
    }

    public function test_sender_cannot_receive_or_self_dispatch_own_qr_transfer(): void
    {
        $budgetHeadToken = $this->loginAs('budget@tracely.app', 'Tracely Web');
        $sgodToken = $this->loginAs('ops@tracely.app', 'Tracely Mobile');

        // 1. Self-dispatch is blocked
        $this->asToken($budgetHeadToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Self Dispatch Attempt',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-budget-1',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_DISPATCH_NOT_ALLOWED');

        // 2. Budget Head sends a document to SGOD, then scans the QR on another device using the SAME account
        $created = $this->asToken($budgetHeadToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Cross-Device Same Account Scan Guard',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'For SGOD receipt only',
            ])
            ->assertCreated();

        $docId = (string) $created->json('data.id');
        $qrToken = (string) $created->json('data.qr_token');

        $this->asToken($budgetHeadToken)
            ->postJson('/api/v1/qr/resolve-document', [
                'token' => "TRC-QR:DOC:{$qrToken}",
            ])
            ->assertOk()
            ->assertJsonPath('pending_for_actor_office', false)
            ->assertJsonPath('sent_by_actor', true);

        // Sender attempting to acknowledge or decline their own dispatch is strictly blocked
        $this->asToken($budgetHeadToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge")
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_RECEIPT_NOT_ALLOWED');

        $this->asToken($budgetHeadToken)
            ->postJson("/api/v1/documents/{$docId}/decline", ['reason' => 'Self decline test'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_DECLINE_NOT_ALLOWED');

        // 3. Even if another user in the SAME office is targeted (internal office dispatch),
        // the sender STILL cannot receive their own pending transfer
        \App\Models\User::query()->where('id', 'usr-budget-2')->update(['availability' => 'available']);
        $internalCreated = $this->asToken($budgetHeadToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Same Office Colleague Dispatch',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-budget-2',
            ])
            ->assertCreated();

        $internalDocId = (string) $internalCreated->json('data.id');
        $internalQrToken = (string) $internalCreated->json('data.qr_token');

        $this->asToken($budgetHeadToken)
            ->postJson('/api/v1/qr/resolve-document', [
                'token' => "TRC-QR:DOC:{$internalQrToken}",
            ])
            ->assertOk()
            ->assertJsonPath('pending_for_actor_office', false)
            ->assertJsonPath('sent_by_actor', true);

        $this->asToken($budgetHeadToken)
            ->postJson("/api/v1/documents/{$internalDocId}/acknowledge")
            ->assertStatus(422)
            ->assertJsonPath('code', 'SELF_RECEIPT_NOT_ALLOWED');

        // Intended recipient (SGOD) CAN scan and confirm receipt normally
        $this->asToken($sgodToken)
            ->postJson('/api/v1/qr/resolve-document', [
                'token' => "TRC-QR:DOC:{$qrToken}",
            ])
            ->assertOk()
            ->assertJsonPath('pending_for_actor_office', true)
            ->assertJsonPath('sent_by_actor', false);

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge", [
                'verification_code' => $qrToken,
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'in_review');
    }

    public function test_admin_account_approval_queue_enforces_roles_and_unlocks_login(): void
    {
        // Register two new pending SDO accounts
        $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Clarissa Mendoza',
            'employee_id' => 'TRC-9101',
            'email' => 'clarissa.mendoza@tracely.app',
            'position' => 'Administrative Aide VI',
            'office_code' => 'BUDGET',
            'password' => 'Clarissa@2026!',
        ])->assertCreated()->assertJsonPath('pending_approval', true);

        $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Reject Candidate',
            'employee_id' => 'TRC-9102',
            'email' => 'reject.candidate@tracely.app',
            'position' => 'Clerk',
            'office_code' => 'OPS',
            'password' => 'Reject@2026!',
        ])->assertCreated()->assertJsonPath('pending_approval', true);

        // Non-approver (Budget Unit Head) cannot access pending queue
        $budgetToken = $this->loginAs('budget@tracely.app', 'Tracely Web');
        $this->asToken($budgetToken)
            ->getJson('/api/v1/admin/pending-users')
            ->assertStatus(403)
            ->assertJsonPath('code', 'FORBIDDEN_APPROVAL_ROLE');

        // ICT Admin can list, approve, and reject pending accounts
        $ictToken = $this->loginAs('ict@tracely.app', 'Tracely Web');
        $listRes = $this->asToken($ictToken)
            ->getJson('/api/v1/admin/pending-users')
            ->assertOk();

        $pendingItems = $listRes->json('data');
        $this->assertCount(2, $pendingItems);

        $approveUser = collect($pendingItems)->firstWhere('employee_id', 'TRC-9101');
        $rejectUser = collect($pendingItems)->firstWhere('employee_id', 'TRC-9102');
        $this->assertNotNull($approveUser);
        $this->assertNotNull($rejectUser);

        $this->asToken($ictToken)
            ->postJson("/api/v1/admin/users/{$approveUser['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.active', true);

        $this->asToken($ictToken)
            ->postJson("/api/v1/admin/users/{$rejectUser['id']}/reject", [
                'reason' => 'Unverified plantilla item',
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false);

        // Approved user can now sign in; rejected user remains blocked
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'clarissa.mendoza@tracely.app',
            'password' => 'Clarissa@2026!',
        ])->assertOk()->assertJsonPath('user.employee_id', 'TRC-9101');

        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'reject.candidate@tracely.app',
            'password' => 'Reject@2026!',
        ])->assertStatus(403);
    }

    public function test_completion_comments_proof_photo_admin_console_and_realtime_pulse(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app', 'Tracely Web');
        $sgodToken = $this->loginAs('ops@tracely.app', 'Tracely Mobile');
        $ictToken = $this->loginAs('ict@tracely.app', 'Tracely Web');

        // 1. Register hard-copy doc & dispatch from Budget to SGOD
        $created = $this->asToken($budgetToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'School Repair Voucher Packet',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'physical_reference' => 'Folder #88',
                'physical_page_count' => 10,
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'For Indorsement',
            ])
            ->assertCreated();

        $docId = (string) $created->json('data.id');
        $docQrToken = (string) $created->json('data.qr_token');
        $txId = (string) $created->json('data.transactions.0.id');

        // 2. Real-time pulse cursor advances for SGOD after dispatch + push token registration works
        $pulseRes = $this->asToken($sgodToken)
            ->getJson('/api/v1/events/pulse?since=0')
            ->assertOk()
            ->assertJsonPath('changed', true)
            ->assertJsonPath('transport', 'live_pulse');
        $cursor1 = (int) $pulseRes->json('cursor');
        $this->assertGreaterThan(0, $cursor1);

        $this->asToken($sgodToken)
            ->postJson('/api/v1/devices/push-token', [
                'token' => 'fcm-test-token-1234567890abcdef',
                'platform' => 'android',
                'device_label' => 'TECNO LJ9',
            ])
            ->assertCreated()
            ->assertJsonPath('data.platform', 'android');

        // 3. SGOD acknowledges with verified QR token + EXIF-stripped receive-proof photo, then fetches signed proof URL + inline stream
        $proofPng = $this->fakePng('stamped_folder.png');
        $proofHash = hash_file('sha256', $proofPng->getRealPath());

        $this->asToken($sgodToken)
            ->post("/api/v1/documents/{$docId}/acknowledge", [
                'verification_code' => $docQrToken,
                'sha256_checksum' => $proofHash,
                'exif_stripped' => '1',
                'proof_photo' => $proofPng,
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.transactions.0.proof_photo.file_name', 'stamped_folder.png');

        $proofGrant = $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/transactions/{$txId}/proof-url")
            ->assertOk();

        $proofUrl = (string) $proofGrant->json('url');
        $this->assertStringContainsString('/proof-stream', $proofUrl);
        $parsedProof = parse_url($proofUrl);
        $proofPath = ($parsedProof['path'] ?? '').(isset($parsedProof['query']) ? '?'.$parsedProof['query'] : '');

        $this->get($proofPath)
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        // 4. Document comments: internal_office note is hidden from other offices; cross_office is shared
        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/comments", [
                'body' => 'Internal SGOD checklist verified.',
                'visibility' => 'internal_office',
            ])
            ->assertCreated()
            ->assertJsonPath('data.visibility', 'internal_office');

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/comments", [
                'body' => 'Ready for final release to school.',
                'visibility' => 'cross_office',
            ])
            ->assertCreated()
            ->assertJsonPath('data.visibility', 'cross_office');

        $sgodComments = $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/{$docId}/comments")
            ->assertOk()
            ->json('data');
        $this->assertCount(2, $sgodComments);

        $budgetComments = $this->asToken($budgetToken)
            ->getJson("/api/v1/documents/{$docId}/comments")
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $budgetComments);
        $this->assertSame('cross_office', $budgetComments[0]['visibility']);

        // 5. Complete document into Approved & Released terminal status
        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/complete", [
                'status' => 'approved',
                'remarks' => 'Approved & Released',
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'approved');

        // 6. ICT Admin Console: create office, update office, update user role/office, deactivate revoking Sanctum token
        $officeRes = $this->asToken($ictToken)
            ->postJson('/api/v1/admin/offices', [
                'code' => 'CASHIER',
                'name' => 'Cashier & Disbursement Unit',
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'CASHIER');

        $cashierId = (string) $officeRes->json('data.id');

        $this->asToken($ictToken)
            ->patchJson("/api/v1/admin/offices/{$cashierId}", [
                'name' => 'Cashier Unit',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Cashier Unit');

        $this->asToken($ictToken)
            ->getJson('/api/v1/admin/users')
            ->assertOk();

        // Update SGOD user office & deactivate -> revokes existing Sanctum token immediately
        $this->asToken($ictToken)
            ->patchJson('/api/v1/admin/users/usr-sgod-1', [
                'office_id' => $cashierId,
                'role' => 'staff',
                'active' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.active', false)
            ->assertJsonPath('data.office.code', 'CASHIER');

        $this->app['auth']->forgetGuards();
        $this->asToken($sgodToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);
    }

    public function test_user_profile_info_and_preferences_update_persists_cleanly(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app', 'Tracely Web');

        // 1. Update personal user profile fields (email remains immutable / read-only)
        $this->asToken($budgetToken)
            ->patchJson('/api/v1/auth/profile', [
                'full_name' => 'Marco A. Villareal',
                'email' => 'attempted.change@tracely.app',
                'position' => 'Supervising Budget Officer',
                'contact_number' => '+63 917 555 0142',
                'desk_note' => '2nd Floor Finance Wing · Window 3',
                'avatar_color' => '#0F766E',
            ])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Marco A. Villareal')
            ->assertJsonPath('data.email', 'budget@tracely.app')
            ->assertJsonPath('data.position', 'Supervising Budget Officer')
            ->assertJsonPath('data.contact_number', '+63 917 555 0142')
            ->assertJsonPath('data.desk_note', '2nd Floor Finance Wing · Window 3')
            ->assertJsonPath('data.avatar_color', '#0F766E');

        // 2. Royal Violet lanyard preference color is also accepted & persisted
        $this->asToken($budgetToken)
            ->patchJson('/api/v1/auth/profile', [
                'avatar_color' => '#5736E4',
            ])
            ->assertOk()
            ->assertJsonPath('data.avatar_color', '#5736E4');

        // Switch back to Teal for reload verification below
        $this->asToken($budgetToken)
            ->patchJson('/api/v1/auth/profile', [
                'avatar_color' => '#0F766E',
            ])
            ->assertOk()
            ->assertJsonPath('data.avatar_color', '#0F766E');

        // 3. Update cross-device user workflow & notification preferences
        $this->asToken($budgetToken)
            ->patchJson('/api/v1/auth/preferences', [
                'default_copy_format' => 'hard_copy',
                'default_routing_scope' => 'internal_office',
                'default_remarks' => 'For Budget Certification',
                'default_landing_screen' => 'sent',
                'compact_density' => true,
                'desktop_notifications' => false,
                'notification_sound' => false,
                'hide_lock_screen_titles' => false,
            ])
            ->assertOk()
            ->assertJsonPath('preferences.default_copy_format', 'hard_copy')
            ->assertJsonPath('preferences.default_routing_scope', 'internal_office')
            ->assertJsonPath('preferences.default_remarks', 'For Budget Certification')
            ->assertJsonPath('preferences.default_landing_screen', 'sent')
            ->assertJsonPath('preferences.compact_density', true)
            ->assertJsonPath('preferences.desktop_notifications', false);

        // 4. Reload /auth/me confirms persisted profile info + preferences
        $this->asToken($budgetToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Marco A. Villareal')
            ->assertJsonPath('data.contact_number', '+63 917 555 0142')
            ->assertJsonPath('data.avatar_color', '#0F766E')
            ->assertJsonPath('data.preferences.default_copy_format', 'hard_copy')
            ->assertJsonPath('data.preferences.default_remarks', 'For Budget Certification');

        // 5. Recalling a pending dispatch returns custody to sender and allows re-editing details before re-sending
        $dispatched = $this->asToken($budgetToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Draft Allotment Release — Typo Title',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'physical_reference' => 'Folder #12',
                'physical_page_count' => 3,
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'For Signature',
            ])
            ->assertCreated();

        $recalledDocId = (string) $dispatched->json('data.id');

        // Editing while still in transit is blocked until recalled
        $this->asToken($budgetToken)
            ->patchJson("/api/v1/documents/{$recalledDocId}", [
                'title' => 'Corrected Allotment Release Memo',
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'DOCUMENT_IN_TRANSIT');

        // Recall transfer -> now sender can edit title, folder reference, page count, and re-forward
        $this->asToken($budgetToken)
            ->postJson("/api/v1/documents/{$recalledDocId}/recall")
            ->assertOk()
            ->assertJsonPath('data.transactions.0.receipt_status', 'recalled');

        $this->asToken($budgetToken)
            ->patchJson("/api/v1/documents/{$recalledDocId}", [
                'title' => 'Corrected Allotment Release Memo',
                'physical_reference' => 'Folder #12-B (Revised)',
                'physical_page_count' => 5,
            ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Corrected Allotment Release Memo')
            ->assertJsonPath('data.physical_reference', 'Folder #12-B (Revised)')
            ->assertJsonPath('data.physical_page_count', 5);
    }

    public function test_admin_studio_provisions_verified_accounts_resets_passwords_and_manages_category_taxonomy(): void
    {
        $adminToken = $this->loginAs('ict@tracely.app');

        // 1. Direct admin account provisioning (auto-approved & active)
        $provisioned = $this->asToken($adminToken)
            ->postJson('/api/v1/admin/users', [
                'full_name' => 'Clarissa D. Mendoza',
                'employee_id' => 'TRC-9201',
                'email' => 'clarissa.mendoza@tracely.app',
                'password' => 'TracelyPass2026!',
                'office_id' => 'off-ict',
                'role' => 'ict_admin',
                'position' => 'Information Technology Officer I',
            ])
            ->assertCreated()
            ->assertJsonPath('data.full_name', 'Clarissa D. Mendoza')
            ->assertJsonPath('data.employee_id', 'TRC-9201')
            ->assertJsonPath('data.email', 'clarissa.mendoza@tracely.app')
            ->assertJsonPath('data.role', 'ict_admin')
            ->assertJsonPath('data.active', true);

        $provisionedUserId = (string) $provisioned->json('data.id');

        // Verify the provisioned user can immediately sign in
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'clarissa.mendoza@tracely.app',
            'password' => 'TracelyPass2026!',
            'device_name' => 'Pixel Test',
        ])->assertOk();

        // 2. Admin resets the user's password and updates position
        $this->asToken($adminToken)
            ->patchJson("/api/v1/admin/users/{$provisionedUserId}", [
                'position' => 'Senior ITO I',
                'new_password' => 'ResetPass2026!',
            ])
            ->assertOk()
            ->assertJsonPath('data.position', 'Senior ITO I');

        // Verify user can sign in with the newly reset password
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'clarissa.mendoza@tracely.app',
            'password' => 'ResetPass2026!',
            'device_name' => 'Pixel Test',
        ])->assertOk();

        // 3. Create, rename, and delete a custom category in the Global Taxonomy
        $createdCat = $this->asToken($adminToken)
            ->postJson('/api/v1/categories', [
                'code' => 'DRRM',
                'name' => 'Disaster Risk Reduction Order',
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'DRRM');

        $catId = (string) $createdCat->json('data.id');

        $this->asToken($adminToken)
            ->patchJson("/api/v1/admin/categories/{$catId}", [
                'code' => 'DRRMO',
                'name' => 'DRRM Executive Advisories',
            ])
            ->assertOk()
            ->assertJsonPath('data.code', 'DRRMO')
            ->assertJsonPath('data.name', 'DRRM Executive Advisories');

        // Deleting an in-use category (cat-1) is blocked with 422 CATEGORY_IN_USE
        $this->asToken($adminToken)
            ->deleteJson('/api/v1/admin/categories/cat-1')
            ->assertStatus(422)
            ->assertJsonPath('code', 'CATEGORY_IN_USE');

        // Deleting the unused category succeeds
        $this->asToken($adminToken)
            ->deleteJson("/api/v1/admin/categories/{$catId}")
            ->assertOk()
            ->assertJsonPath('deleted_id', $catId);
    }

    public function test_standalone_blade_admin_portal_enforces_separate_login_and_manages_governance_studio(): void
    {
        // 1. Unauthenticated visit to /admin redirects to /admin/login
        $this->get('/admin')->assertRedirect('/admin/login');

        // 2. /admin/login renders the DocsTracker Admin Blade login view from c:\docstrack\admin\views with official logo
        $this->get('/admin/login')
            ->assertOk()
            ->assertSee('Sign in to Admin Portal')
            ->assertSee('Tracely Admin')
            ->assertSee('images/tracely-logo.png');

        // 3. Non-admin account (budget@tracely.app) is rejected at the standalone Admin login gate
        $this->post('/admin/login', [
            'identifier' => 'budget@tracely.app',
            'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
        ])->assertSessionHasErrors('identifier');

        // 4. Authorized ICT Admin account signs in via /admin/login and accesses the Blade Admin Portal
        $this->post('/admin/login', [
            'identifier' => 'ict@tracely.app',
            'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
        ])->assertRedirect('/admin');

        $this->get('/admin')
            ->assertOk()
            ->assertSee('Operations Overview')
            ->assertSee('Division Office Load')
            ->assertSee('Arvin Soriano')
            ->assertSee('images/tracely-logo.png');

        // 4b. Dedicated Add Administrator flow creates an Admin account and separates Admins from Personnel Users
        $this->post('/admin/admins', [
            'full_name' => 'Engr. Paolo R. Cruz',
            'employee_id' => 'ADM-9501',
            'email' => 'paolo.cruz@tracely.app',
            'position' => 'Information Technology Officer II',
            'office_id' => 'off-ict',
            'role' => 'ict_admin',
            'password' => 'Admin@2026!',
        ])->assertRedirect('/admin?section=admins');

        $this->assertDatabaseHas('users', [
            'employee_id' => 'ADM-9501',
            'email' => 'paolo.cruz@tracely.app',
            'role' => 'ict_admin',
            'active' => 1,
        ]);

        // Verify strict separation in rendered tables:
        // Admins appear in #admins-tbody and NEVER in #personnel-tbody; Users appear in #personnel-tbody and NEVER in #admins-tbody.
        $dashboardHtml = $this->get('/admin?section=personnel')->assertOk()->getContent();
        $this->assertIsString($dashboardHtml);
        preg_match('/<tbody id="admins-tbody">(.*?)<\/tbody>/s', $dashboardHtml, $adminsTableMatch);
        preg_match('/<tbody id="personnel-tbody">(.*?)<\/tbody>/s', $dashboardHtml, $personnelTableMatch);
        $this->assertNotEmpty($adminsTableMatch[1] ?? '');
        $this->assertNotEmpty($personnelTableMatch[1] ?? '');
        $this->assertStringContainsString('paolo.cruz@tracely.app', $adminsTableMatch[1]);
        $this->assertStringContainsString('ict@tracely.app', $adminsTableMatch[1]);
        $this->assertStringNotContainsString('budget@tracely.app', $adminsTableMatch[1]);
        $this->assertStringContainsString('budget@tracely.app', $personnelTableMatch[1]);
        $this->assertStringNotContainsString('paolo.cruz@tracely.app', $personnelTableMatch[1]);
        $this->assertStringNotContainsString('ict@tracely.app', $personnelTableMatch[1]);

        // 5. Provision a new verified SDO account via the Blade form
        $this->post('/admin/users', [
            'full_name' => 'Patricia R. Gomez',
            'employee_id' => 'TRC-9401',
            'email' => 'patricia.gomez@tracely.app',
            'position' => 'Administrative Officer II',
            'office_id' => 'off-records',
            'role' => 'records_officer',
            'password' => 'Patricia@2026!',
        ])->assertRedirect('/admin?section=personnel');

        $this->assertDatabaseHas('users', [
            'employee_id' => 'TRC-9401',
            'email' => 'patricia.gomez@tracely.app',
            'role' => 'records_officer',
            'active' => 1,
        ]);

        // 6. Create a new SDO Office and a new Document Category via the Blade portal
        $this->post('/admin/offices', [
            'code' => 'SUPPLY',
            'name' => 'Property & Supply Unit',
        ])->assertRedirect('/admin?section=offices');

        $this->assertDatabaseHas('offices', [
            'code' => 'SUPPLY',
            'name' => 'Property & Supply Unit',
        ]);

        $this->post('/admin/categories', [
            'code' => 'EXEC',
            'name' => 'Executive Division Order',
        ])->assertRedirect('/admin?section=categories');

        $this->assertDatabaseHas('document_categories', [
            'code' => 'EXEC',
            'name' => 'Executive Division Order',
        ]);

        // 6a. Deleting both an unused category AND an in-use category (with document reassignment) works cleanly
        $execCategory = \App\Models\DocumentCategory::query()->where('code', 'EXEC')->firstOrFail();
        $this->delete("/admin/categories/{$execCategory->id}")
            ->assertRedirect('/admin?section=categories');
        $this->assertDatabaseMissing('document_categories', ['id' => $execCategory->id]);

        $inUseCat = \App\Models\DocumentCategory::query()->where('id', 'cat-1')->firstOrFail();
        $replacementCat = \App\Models\DocumentCategory::query()->where('id', '!=', $inUseCat->id)->firstOrFail();
        $affectedDocIds = Document::query()->where('category_id', $inUseCat->id)->pluck('id')->all();
        $this->assertNotEmpty($affectedDocIds);

        $this->delete("/admin/categories/{$inUseCat->id}", [
            'replacement_category_id' => $replacementCat->id,
        ])->assertRedirect('/admin?section=categories');

        $this->assertDatabaseMissing('document_categories', ['id' => $inUseCat->id]);
        foreach ($affectedDocIds as $movedDocId) {
            $this->assertDatabaseHas('documents', [
                'id' => $movedDocId,
                'category_id' => $replacementCat->id,
            ]);
        }

        // 6b. Provisioning a user with a Custom Office creates the office and assigns the user
        $this->post('/admin/users', [
            'full_name' => 'Ramon C. Delos Reyes',
            'employee_id' => 'TRC-9455',
            'email' => 'ramon.delosreyes@tracely.app',
            'position' => 'School Principal II',
            'office_id' => '__custom__',
            'custom_office_code' => 'PNHS',
            'custom_office_name' => 'Pinamalayan National High School',
            'role' => 'unit_head',
            'password' => 'Ramon@2026!',
        ])->assertRedirect('/admin?section=personnel');

        $this->assertDatabaseHas('offices', [
            'code' => 'PNHS',
            'name' => 'Pinamalayan National High School',
            'is_custom' => 1,
        ]);
        $this->assertDatabaseHas('users', [
            'employee_id' => 'TRC-9455',
            'email' => 'ramon.delosreyes@tracely.app',
        ]);

        // 6c. Dedicated Document Tracking page renders the connected-dot timeline stage
        $this->get('/admin?section=tracking')
            ->assertOk()
            ->assertSee('Document Tracking')
            ->assertSee('Custody Journey Checkpoints');

        // 6d. Manual Admin Office Alert creates an in-app notification for the target office
        $sampleDoc = Document::query()->firstOrFail();
        $this->post("/admin/documents/{$sampleDoc->id}/notify-office", [
            'message' => 'Please prioritize signature and release today.',
            'return_section' => 'overview',
        ])->assertRedirect('/admin?section=overview');

        $this->assertDatabaseHas('user_notifications', [
            'document_id' => $sampleDoc->id,
            'title' => 'Admin Follow-Up Alert · TRC-2026-••••••',
            'content' => 'Please prioritize signature and release today.',
        ]);

        // 6e. Automatic stalled ("tengga") alert sweep detects old idle documents and avoids duplicate spam
        $stalledDoc = Document::query()
            ->where('id', '!=', $sampleDoc->id)
            ->whereNotIn('lifecycle_status', ['approved', 'archived'])
            ->firstOrFail();
        $stalledDoc->transactions()->update([
            'sent_at' => now()->subHours(40),
            'acknowledged_at' => now()->subHours(38),
        ]);
        $stalledDoc->update(['updated_at' => now()->subHours(38)]);

        $this->post('/admin/alerts/run-stalled-sweep', [
            'return_section' => 'custody',
        ])->assertRedirect('/admin?section=custody');

        $this->assertDatabaseHas('user_notifications', [
            'document_id' => $stalledDoc->id,
            'title' => 'Auto Stalled Document Alert · TRC-2026-••••••',
        ]);

        $autoAlertsBeforeSecondSweep = \App\Models\UserNotification::query()
            ->where('document_id', $stalledDoc->id)
            ->where('title', 'Auto Stalled Document Alert · TRC-2026-••••••')
            ->count();

        // Running sweep again within 12h cooldown must NOT duplicate the notification
        $this->post('/admin/alerts/run-stalled-sweep', [
            'return_section' => 'custody',
        ])->assertRedirect('/admin?section=custody');

        $autoAlertsAfterSecondSweep = \App\Models\UserNotification::query()
            ->where('document_id', $stalledDoc->id)
            ->where('title', 'Auto Stalled Document Alert · TRC-2026-••••••')
            ->count();
        $this->assertSame($autoAlertsBeforeSecondSweep, $autoAlertsAfterSecondSweep);

        // 7. CSV exports stream valid CSV attachments
        $this->get('/admin/export/documents.csv')->assertOk();
        $this->get('/admin/export/audit-logs.csv')->assertOk();

        // 8. Sign out clears the standalone admin portal session
        $this->post('/admin/logout')->assertRedirect('/admin/login');
        $this->get('/admin')->assertRedirect('/admin/login');
    }

    public function test_admin_architectural_governance_suite_covers_all_six_capabilities(): void
    {
        // Sign into the standalone Laravel Blade Admin Portal as ICT Admin
        $this->post('/admin/login', [
            'identifier' => 'ict@tracely.app',
            'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
        ])->assertRedirect('/admin');

        // 1. Per-Category SLA Policy & Escalation Rules Engine
        $this->post('/admin/sla-policies', [
            'category_id' => 'cat-2',
            'target_hours' => 12,
            'stalled_alert_hours' => 6,
            'escalation_hours' => 12,
            'escalate_to_office_id' => 'off-osds',
            'active' => 1,
        ])->assertRedirect('/admin?section=sla-policies');

        $this->assertDatabaseHas('sla_policies', [
            'category_id' => 'cat-2',
            'target_hours' => 12,
            'stalled_alert_hours' => 6,
            'escalation_hours' => 12,
            'escalate_to_office_id' => 'off-osds',
            'active' => 1,
        ]);

        // Creating a new document in cat-2 automatically applies the 12h policy SLA deadline
        $sgodToken = $this->loginAs('ops@tracely.app', 'Android Field Scanner');
        $createdDocResp = $this->asToken($sgodToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Urgent School Roof Repair Endorsement',
                'category_id' => 'cat-2',
                'confidentiality_tier' => 'standard_internal',
                'physical_reference' => 'Folder #88',
                'physical_page_count' => 4,
            ])
            ->assertCreated();
        $policyDocId = (string) $createdDocResp->json('data.id');
        $policyDoc = Document::query()->findOrFail($policyDocId);
        $hoursUntilDue = now()->diffInHours($policyDoc->sla_due_at, false);
        $this->assertGreaterThanOrEqual(10, $hoursUntilDue);
        $this->assertLessThanOrEqual(13, $hoursUntilDue);

        // Age the document past 14h (via query builder so Eloquent doesn't reset updated_at) and run sweep -> triggers BOTH stalled office alert AND OSDS escalation!
        \Illuminate\Support\Facades\DB::table('documents')
            ->where('id', $policyDoc->id)
            ->update([
                'created_at' => now()->subHours(15),
                'updated_at' => now()->subHours(14),
            ]);
        $this->post('/admin/alerts/run-stalled-sweep', ['return_section' => 'sla-policies'])
            ->assertRedirect('/admin?section=sla-policies');

        $this->assertDatabaseHas('user_notifications', [
            'document_id' => $policyDoc->id,
            'target_office_id' => 'off-osds',
            'title' => "SLA Escalation Alert · {$policyDoc->tracking_code}",
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'document_id' => $policyDoc->id,
            'action' => 'sla_escalation_sent',
        ]);

        // 2. Active Sanctum Device Sessions & Remote Kill-Switch Center
        $budgetToken = $this->loginAs('budget@tracely.app', 'Budget Chrome Desk');
        $this->get('/admin?section=sessions')
            ->assertOk()
            ->assertSee('Budget Chrome Desk')
            ->assertSee('Android Field Scanner');

        $budgetPat = \Laravel\Sanctum\PersonalAccessToken::query()
            ->where('tokenable_id', 'usr-budget-1')
            ->latest('id')
            ->firstOrFail();

        $this->delete("/admin/sessions/{$budgetPat->id}")
            ->assertRedirect('/admin?section=sessions');

        $this->app['auth']->forgetGuards();
        $this->asToken($budgetToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // Force sign-out all non-admin staff sessions kill-switch
        $this->post('/admin/sessions/revoke-all-non-admin')
            ->assertRedirect('/admin?section=sessions');

        $this->app['auth']->forgetGuards();
        $this->asToken($sgodToken)
            ->getJson('/api/v1/auth/me')
            ->assertStatus(401);

        // 3. Office Custody Reassignment & Leave-Delegate Override
        $this->patch('/admin/users/usr-budget-1', [
            'role' => 'unit_head',
            'office_id' => 'off-budget',
            'position' => 'Budget Officer II',
            'availability' => 'on_leave',
            'availability_until' => now()->addDays(5)->format('Y-m-d'),
            'delegate_id' => 'usr-acct-1',
            'return_section' => 'personnel',
        ])->assertRedirect('/admin?section=personnel');

        $this->assertDatabaseHas('users', [
            'id' => 'usr-budget-1',
            'availability' => 'on_leave',
            'delegate_id' => 'usr-acct-1',
        ]);

        $budgetHeldBefore = Document::query()
            ->where('current_holder_id', 'usr-budget-1')
            ->whereNotIn('lifecycle_status', ['approved', 'archived'])
            ->pluck('id')
            ->all();
        $this->assertNotEmpty($budgetHeldBefore);

        $this->post('/admin/users/usr-budget-1/reassign-custody', [
            'target_user_id' => 'usr-acct-1',
            'reason' => 'Officer on unplanned medical leave',
            'return_section' => 'personnel',
        ])->assertRedirect('/admin?section=personnel');

        foreach ($budgetHeldBefore as $movedId) {
            $this->assertDatabaseHas('documents', [
                'id' => $movedId,
                'current_holder_id' => 'usr-acct-1',
                'current_office_id' => 'off-acct',
            ]);
            $this->assertDatabaseHas('routing_transactions', [
                'document_id' => $movedId,
                'from_user_id' => 'usr-budget-1',
                'to_user_id' => 'usr-acct-1',
                'remarks' => 'Admin Custody Reassignment: Officer on unplanned medical leave',
            ]);
        }

        // 4. File Integrity & Storage Health Verifier (SHA-256 + Disk Audit)
        $this->post('/admin/integrity/verify')
            ->assertRedirect('/admin?section=integrity')
            ->assertSessionHas('admin_toast');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'integrity_audit_completed',
        ]);

        // Tamper with one file on disk and verify mismatch is caught!
        $sampleVersion = \App\Models\DocumentVersion::query()->firstOrFail();
        $originalBytes = \Illuminate\Support\Facades\Storage::disk('local')->get($sampleVersion->storage_key);
        \Illuminate\Support\Facades\Storage::disk('local')->put($sampleVersion->storage_key, $originalBytes.'TAMPERED');

        $this->post('/admin/integrity/verify')
            ->assertRedirect('/admin?section=integrity')
            ->assertSessionHas('admin_error');

        $this->get('/admin?section=integrity')
            ->assertOk()
            ->assertSee('SHA-256 Mismatch');

        // Restore original bytes so local storage remains pristine
        \Illuminate\Support\Facades\Storage::disk('local')->put($sampleVersion->storage_key, $originalBytes);

        // 5. Real-Time Delivery & Push Diagnostics (SSE / Pulse / FCM Health)
        $pushToken = \App\Models\DevicePushToken::query()->create([
            'id' => 'dpt-test-1',
            'user_id' => 'usr-sgod-1',
            'platform' => 'android',
            'token' => 'fcm-test-token-sgod-001',
            'device_label' => 'Samsung Galaxy A55 (SGOD)',
            'last_seen_at' => now()->subMinutes(5),
        ]);

        $this->get('/admin?section=diagnostics')
            ->assertOk()
            ->assertSee('Samsung Galaxy A55 (SGOD)');

        $this->post('/admin/diagnostics/test-push', [
            'target_user_id' => 'usr-sgod-1',
        ])->assertRedirect('/admin?section=diagnostics');

        $this->assertDatabaseHas('push_delivery_logs', [
            'event_type' => 'diagnostic_ping',
            'target_user_id' => 'usr-sgod-1',
        ]);

        $this->delete("/admin/diagnostics/tokens/{$pushToken->id}")
            ->assertRedirect('/admin?section=diagnostics');
        $this->assertDatabaseMissing('device_push_tokens', ['id' => 'dpt-test-1']);

        // 6. Printable Executive SLA & Bottleneck Report
        $this->get('/admin/reports/executive-sla?month=all')
            ->assertOk()
            ->assertSee('Executive Document SLA')
            ->assertSee('Tracely Governance Console')
            ->assertSee('Office Throughput')
            ->assertSee('Executive Director');
    }

    public function test_qr_gated_access_manual_tracking_code_resolution_and_admin_live_pulse(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app', 'Tracely Web');
        $sgodToken = $this->loginAs('ops@tracely.app', 'Tracely Mobile');

        $pdf = UploadedFile::fake()->createWithContent('qr_gated_memo.pdf', "%PDF-1.4\nQRGate\n%%EOF");
        $createRes = $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'QR-Gated Division Memorandum',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'Please scan QR slip to unlock',
                'file' => $pdf,
            ], ['Accept' => 'application/json'])
            ->assertCreated();

        $docId = (string) $createRes->json('data.id');
        $trackingCode = (string) $createRes->json('data.tracking_code');
        $qrToken = (string) $createRes->json('data.qr_token');

        // Sender retains full unsealed access & presigned viewing to their own dispatched document
        $this->asToken($budgetToken)
            ->getJson("/api/v1/documents/{$docId}")
            ->assertOk()
            ->assertJsonPath('data.is_sealed', false)
            ->assertJsonPath('data.title', 'QR-Gated Division Memorandum')
            ->assertJsonPath('data.qr_token', $qrToken);

        $this->asToken($budgetToken)
            ->postJson("/api/v1/documents/{$docId}/versions/1/presigned-url")
            ->assertOk();

        // Pending recipient receives a SEALED QR envelope only — title, tracking code, qr_token, versions & comments are hidden!
        $sealedShow = $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/{$docId}")
            ->assertOk()
            ->assertJsonPath('data.is_sealed', true)
            ->assertJsonPath('data.title', 'Sealed Incoming Document')
            ->assertJsonPath('data.qr_token', '')
            ->assertJsonPath('data.attachment_count', 1)
            ->assertJsonCount(0, 'data.versions');
        $this->assertNotSame($trackingCode, $sealedShow->json('data.tracking_code'));
        $this->assertStringContainsString('••••', (string) $sealedShow->json('data.tracking_code'));

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/versions/1/presigned-url")
            ->assertStatus(403)
            ->assertJsonPath('code', 'RECEIPT_REQUIRED_BEFORE_ACCESS');

        $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/{$docId}/comments")
            ->assertStatus(403)
            ->assertJsonPath('code', 'RECEIPT_REQUIRED_BEFORE_ACCESS');

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/comments", ['body' => 'Should be blocked while sealed'])
            ->assertStatus(403)
            ->assertJsonPath('code', 'RECEIPT_REQUIRED_BEFORE_ACCESS');

        // Acknowledging without scanning / supplying the sender's QR token is strictly rejected
        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge")
            ->assertStatus(422)
            ->assertJsonPath('code', 'QR_VERIFICATION_REQUIRED');

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge", ['verification_code' => 'wrong-token-0000'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'QR_VERIFICATION_MISMATCH');

        // Recipient notification masks the document title & tracking code until QR scan
        $notifRes = $this->asToken($sgodToken)
            ->getJson('/api/v1/notifications')
            ->assertOk();
        $this->assertStringContainsString('Sealed QR Incoming', (string) $notifRes->json('data.0.title'));
        $this->assertStringNotContainsString('QR-Gated Division Memorandum', (string) $notifRes->json('data.0.content'));
        $this->assertStringNotContainsString($trackingCode, (string) $notifRes->json('data.0.content'));

        // Scanning/entering the sender's QR payload or tracking code verifies and returns verification_code
        $this->asToken($sgodToken)
            ->postJson('/api/v1/qr/resolve-document', ['token' => strtolower($trackingCode)])
            ->assertOk()
            ->assertJsonPath('data.id', $docId)
            ->assertJsonPath('pending_for_actor_office', true)
            ->assertJsonPath('verification_code', $qrToken);

        $this->asToken($sgodToken)
            ->getJson('/api/v1/qr/document/'.urlencode($trackingCode))
            ->assertOk()
            ->assertJsonPath('data.id', $docId)
            ->assertJsonPath('pending_for_actor_office', true);

        $this->asToken($sgodToken)
            ->postJson('/api/v1/qr/resolve-document', ['token' => $qrToken])
            ->assertOk()
            ->assertJsonPath('data.id', $docId)
            ->assertJsonPath('data.title', 'QR-Gated Division Memorandum');

        // Once SGOD acknowledges with the verified QR token, full document, comments & presigned access unlock immediately
        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/acknowledge", [
                'verification_code' => "TRC-QR:DOC:{$qrToken}",
            ])
            ->assertOk()
            ->assertJsonPath('data.lifecycle_status', 'in_review')
            ->assertJsonPath('data.is_sealed', false)
            ->assertJsonPath('data.title', 'QR-Gated Division Memorandum')
            ->assertJsonPath('data.tracking_code', $trackingCode)
            ->assertJsonCount(1, 'data.versions');

        $this->asToken($sgodToken)
            ->postJson("/api/v1/documents/{$docId}/versions/1/presigned-url")
            ->assertOk()
            ->assertJsonStructure(['url', 'expires_at', 'ttl_seconds', 'version']);

        $this->asToken($sgodToken)
            ->getJson("/api/v1/documents/{$docId}/comments")
            ->assertOk();

        // Admin Portal Live-Pulse endpoint tracks live cursor + DB fingerprint without manual refresh
        $this->app['auth']->forgetGuards();
        $this->getJson('/admin/live-pulse')->assertStatus(401);

        $this->post('/admin/login', [
            'identifier' => 'ict@tracely.app',
            'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
        ])->assertRedirect('/admin');

        $this->get('/admin')
            ->assertOk()
            ->assertSee('Live Sync')
            ->assertSee('admin-live-sync-pill');

        $pulseBefore = $this->getJson('/admin/live-pulse')
            ->assertOk()
            ->assertJsonStructure(['cursor', 'changed', 'fingerprint', 'pending_approvals', 'total_documents', 'server_time'])
            ->json();

        // Creating a category via Admin Portal bumps both global realtime cursor and live-pulse fingerprint
        $this->post('/admin/categories', [
            'name' => 'Live Sync Verification Category',
            'code' => 'LSVC',
        ])->assertRedirect('/admin?section=categories');

        $pulseAfter = $this->getJson('/admin/live-pulse?since='.$pulseBefore['cursor'])
            ->assertOk()
            ->assertJsonPath('changed', true)
            ->json();

        $this->assertGreaterThan($pulseBefore['cursor'], $pulseAfter['cursor']);
        $this->assertNotSame($pulseBefore['fingerprint'], $pulseAfter['fingerprint']);
    }

    public function test_soft_copy_desktop_mobile_unlock_qr_short_code_and_password_fallback(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app', 'Tracely Web');
        $opsToken = $this->loginAs('ops@tracely.app', 'Tracely Web');
        $opsMobileToken = $this->loginAs('ops@tracely.app', 'Tracely Mobile');
        $recordsToken = $this->loginAs('records@tracely.app', 'Tracely Mobile');

        // 1. Dispatch Soft Copy #1 from Budget -> OPS (to test live Desktop QR scan via Mobile)
        $pdf1 = UploadedFile::fake()->createWithContent('soft_sync_1.pdf', '%PDF-1.4 soft copy sync 1');
        $sha1 = hash_file('sha256', $pdf1->getRealPath());
        $doc1 = $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'Soft Copy Sync Test One',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'remarks' => 'Unlock on phone',
                'sha256_checksum' => $sha1,
                'file' => $pdf1,
            ])
            ->assertCreated()
            ->json('data');

        // OPS on Desktop generates a single-use live Unlock QR + 6-char code
        $challenge1 = $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$doc1['id']}/unlock-challenge")
            ->assertCreated()
            ->assertJsonStructure(['challenge_id', 'document_id', 'token', 'qr_payload', 'short_code', 'expires_at'])
            ->json();

        $this->assertStringStartsWith('TRC-QR:UNLOCK:', $challenge1['qr_payload']);
        $this->assertMatchesRegularExpression('/^[2-9A-HJ-NP-Z]{3}-[2-9A-HJ-NP-Z]{3}$/', $challenge1['short_code']);

        // Different user scanning that Desktop QR is rejected with 403
        $this->asToken($recordsToken)
            ->postJson('/api/v1/qr/consume-unlock', ['code' => $challenge1['qr_payload']])
            ->assertStatus(403)
            ->assertJsonPath('code', 'UNLOCK_CHALLENGE_USER_MISMATCH');

        // OPS Mobile scans the Desktop QR -> unlocks, records milestone in Track, and writes audit log
        $unlocked1 = $this->asToken($opsMobileToken)
            ->postJson('/api/v1/qr/consume-unlock', ['code' => $challenge1['qr_payload']])
            ->assertOk()
            ->assertJsonPath('data.is_sealed', false)
            ->assertJsonPath('data.title', 'Soft Copy Sync Test One')
            ->assertJsonPath('data.lifecycle_status', 'in_review')
            ->json('data');

        $this->assertNotEmpty($unlocked1['versions']);
        $this->assertDatabaseHas('external_milestones', [
            'document_id' => $doc1['id'],
            'stage_label' => 'Received by OPS',
        ]);

        // Reusing the single-use challenge is rejected
        $this->asToken($opsMobileToken)
            ->postJson('/api/v1/qr/consume-unlock', ['code' => $challenge1['qr_payload']])
            ->assertStatus(422)
            ->assertJsonPath('code', 'UNLOCK_CHALLENGE_USED');

        // 2. Dispatch Soft Copy #2 to test 6-char short code entry on Mobile
        $pdf2 = UploadedFile::fake()->createWithContent('soft_sync_2.pdf', '%PDF-1.4 soft copy sync 2');
        $sha2 = hash_file('sha256', $pdf2->getRealPath());
        $doc2 = $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'Soft Copy Short Code Test Two',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'sha256_checksum' => $sha2,
                'file' => $pdf2,
            ])
            ->assertCreated()
            ->json('data');

        $challenge2 = $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$doc2['id']}/unlock-challenge")
            ->assertCreated()
            ->json();

        // Enter 6-char code lowercase without hyphen -> unlocks cleanly
        $rawSixChar = strtolower(str_replace('-', '', $challenge2['short_code']));
        $this->asToken($opsMobileToken)
            ->postJson('/api/v1/qr/consume-unlock', ['code' => $rawSixChar])
            ->assertOk()
            ->assertJsonPath('data.is_sealed', false)
            ->assertJsonPath('data.title', 'Soft Copy Short Code Test Two');

        // 3. Dispatch Soft Copy #3 to test Account Password fallback (wrong rejected, correct unlocks & saves in Track)
        $pdf3 = UploadedFile::fake()->createWithContent('soft_sync_3.pdf', '%PDF-1.4 soft copy password fallback');
        $sha3 = hash_file('sha256', $pdf3->getRealPath());
        $doc3 = $this->asToken($budgetToken)
            ->post('/api/v1/documents', [
                'title' => 'Soft Copy Password Fallback Three',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'sha256_checksum' => $sha3,
                'file' => $pdf3,
            ])
            ->assertCreated()
            ->json('data');

        $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$doc3['id']}/acknowledge", ['password' => 'WrongPass999!'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'INVALID_PASSWORD');

        $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$doc3['id']}/acknowledge", [
                'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_sealed', false)
            ->assertJsonPath('data.title', 'Soft Copy Password Fallback Three')
            ->assertJsonPath('data.lifecycle_status', 'in_review');

        $this->assertDatabaseHas('external_milestones', [
            'document_id' => $doc3['id'],
            'stage_label' => 'Received by OPS',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'document_id' => $doc3['id'],
            'action' => 'acknowledged',
        ]);

        // 4. Hard Copy MUST reject BOTH Desktop unlock challenge AND password fallback
        $hardDoc = $this->asToken($budgetToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Physical Folder Strictly QR Gated',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'standard_internal',
                'recipient_user_id' => 'usr-sgod-1',
                'physical_reference' => 'Folder #44',
                'physical_page_count' => 8,
            ])
            ->assertCreated()
            ->json('data');

        $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$hardDoc['id']}/unlock-challenge")
            ->assertStatus(422)
            ->assertJsonPath('code', 'UNLOCK_CHALLENGE_DIGITAL_ONLY');

        $this->asToken($opsToken)
            ->postJson("/api/v1/documents/{$hardDoc['id']}/acknowledge", [
                'password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
            ])
            ->assertStatus(422)
            ->assertJsonPath('code', 'PASSWORD_UNLOCK_NOT_ALLOWED');
    }

    public function test_security_hardening_routing_templates_analytics_password_reset_and_server_pagination(): void
    {
        $budgetToken = $this->loginAs('budget@tracely.app');
        $ictToken = $this->loginAs('ict@tracely.app');

        // 1. Privacy masking in Stalled Document Alerts: confidential & sealed transfers never leak title or full code
        $confCreated = $this->asToken($budgetToken)
            ->postJson('/api/v1/documents/hard-copy', [
                'title' => 'Strictly Confidential Investigation Dossier',
                'category_id' => 'cat-1',
                'confidentiality_tier' => 'confidential',
                'recipient_user_id' => 'usr-sgod-1',
            ])
            ->assertCreated()
            ->json('data');
        $confDoc = Document::query()->findOrFail($confCreated['id']);
        $stalledSvc = app(\App\Services\StalledDocumentAlertService::class);
        $alertRes = $stalledSvc->notifyOfficeForDocument($confDoc, null, null, true);
        $this->assertStringNotContainsString($confDoc->title, $alertRes['notification']->content);
        $this->assertStringNotContainsString($confDoc->tracking_code, $alertRes['notification']->title);
        $this->assertStringContainsString('••••••', $alertRes['notification']->title);

        // 2. Scheduled ephemeral pruning removes expired unlock challenges, desktop pairings, and reset codes
        \App\Models\DocumentUnlockChallenge::query()->create([
            'id' => 'chl-expired-test',
            'token' => 'expiredtoken1234567890abcdef1234',
            'short_code' => 'ZZZ999',
            'document_id' => 'doc-142',
            'user_id' => 'usr-budget-1',
            'office_id' => 'off-budget',
            'expires_at' => now()->subDays(2),
        ]);
        \App\Models\DesktopPairing::query()->create([
            'pair_token' => 'pair-expired-test-999',
            'owner_user_id' => 'usr-budget-1',
            'draft_label' => 'Old draft',
            'expires_at' => now()->subDays(2),
        ]);
        $this->artisan('tracely:prune-ephemeral')->assertExitCode(0);
        $this->assertDatabaseMissing('document_unlock_challenges', ['id' => 'chl-expired-test']);
        $this->assertDatabaseMissing('desktop_pairings', ['pair_token' => 'pair-expired-test-999']);

        // 3. Saved Routing Templates (create, list, delete)
        $createdTpl = $this->asToken($budgetToken)
            ->postJson('/api/v1/routing-templates', [
                'name' => 'Standard Budget Clearance',
                'description' => 'Budget -> Accounting -> Executive',
                'category_id' => 'cat-1',
                'is_global' => true,
                'steps' => [
                    ['office_id' => 'off-budget', 'default_remarks' => 'For Budget Certification'],
                    ['office_id' => 'off-acct', 'default_remarks' => 'For Pre-Audit'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('Standard Budget Clearance', $createdTpl['name']);
        $this->assertCount(2, $createdTpl['steps']);
        $this->assertTrue($createdTpl['is_global']);

        $this->asToken($ictToken)
            ->getJson('/api/v1/routing-templates')
            ->assertOk()
            ->assertJsonFragment(['id' => $createdTpl['id'], 'name' => 'Standard Budget Clearance']);

        $this->asToken($budgetToken)
            ->deleteJson("/api/v1/routing-templates/{$createdTpl['id']}")
            ->assertOk()
            ->assertJsonPath('deleted', true);

        // 4. Office Turnaround & SLA Analytics
        $analytics = $this->asToken($ictToken)
            ->getJson('/api/v1/analytics/turnaround')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThan(0, $analytics['summary']['total_documents']);
        $this->assertCount(6, $analytics['monthly_throughput']);
        $this->assertNotEmpty($analytics['by_office']);

        // 5. Server-side search, filter & optional pagination on GET /api/v1/documents
        $paged = $this->asToken($budgetToken)
            ->getJson('/api/v1/documents?per_page=1&page=1')
            ->assertOk()
            ->json();

        $this->assertCount(1, $paged['data']);
        $this->assertSame(1, $paged['meta']['current_page']);
        $this->assertSame(1, $paged['meta']['per_page']);
        $this->assertGreaterThanOrEqual(2, $paged['meta']['total']);

        // 6. Self-service Forgot Password -> Reset Password + must_change_password on admin reset
        $resetReq = $this->postJson('/api/v1/auth/forgot-password', [
            'identifier' => 'budget@tracely.app',
        ])
            ->assertOk()
            ->json();
        $this->assertNotEmpty($resetReq['dev_reset_code'] ?? null);

        $this->postJson('/api/v1/auth/reset-password', [
            'identifier' => 'budget@tracely.app',
            'reset_code' => $resetReq['dev_reset_code'],
            'new_password' => 'ResetPass#2026!',
        ])
            ->assertOk();

        // New password works; admin reset sets must_change_password = true, then /auth/password clears it
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'budget@tracely.app',
            'password' => 'ResetPass#2026!',
        ])->assertOk()->assertJsonPath('user.must_change_password', false);

        $this->asToken($ictToken)
            ->patchJson('/api/v1/admin/users/usr-budget-1', [
                'new_password' => 'TempAdmin#2026!',
            ])
            ->assertOk()
            ->assertJsonPath('data.must_change_password', true);

        $tempLogin = $this->postJson('/api/v1/auth/login', [
            'identifier' => 'budget@tracely.app',
            'password' => 'TempAdmin#2026!',
        ])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', true)
            ->json();

        $this->asToken($tempLogin['token'])
            ->postJson('/api/v1/auth/password', [
                'current_password' => 'TempAdmin#2026!',
                'new_password' => DatabaseSeeder::DEV_DEFAULT_PASSWORD,
            ])
            ->assertOk()
            ->assertJsonPath('user.must_change_password', false);

        // 7. Rate limiter protects /qr/consume-unlock against rapid brute-force guessing
        $freshToken = $this->loginAs('budget@tracely.app');
        $throttled = false;
        for ($attempt = 0; $attempt < 12; $attempt++) {
            $resp = $this->asToken($freshToken)->postJson('/api/v1/qr/consume-unlock', [
                'code' => 'AAA-222',
            ]);
            if ($resp->status() === 429) {
                $throttled = true;
                break;
            }
        }
        $this->assertTrue($throttled, 'Expected 429 rate-limit response on repeated unlock code attempts.');
    }
}
