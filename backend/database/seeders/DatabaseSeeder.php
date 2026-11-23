<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentVersion;
use App\Models\ExternalMilestone;
use App\Models\Office;
use App\Models\RoutingTransaction;
use App\Models\School;
use App\Models\SlaPolicy;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class DatabaseSeeder extends Seeder
{
    public const DEV_DEFAULT_PASSWORD = 'Tracely@2026!';

    public function run(): void
    {
        $offices = [
            ['id' => 'off-records', 'code' => 'RECORDS', 'name' => 'Records & Registry'],
            ['id' => 'off-osds', 'code' => 'EXEC', 'name' => 'Executive Office'],
            ['id' => 'off-cid', 'code' => 'PROG', 'name' => 'Program Management Office'],
            ['id' => 'off-sgod', 'code' => 'OPS', 'name' => 'Operations & Facilities Unit'],
            ['id' => 'off-budget', 'code' => 'BUDGET', 'name' => 'Budget Unit'],
            ['id' => 'off-acct', 'code' => 'ACCT', 'name' => 'Accounting Unit'],
            ['id' => 'off-hr', 'code' => 'HR', 'name' => 'Human Resource Management Unit'],
            ['id' => 'off-legal', 'code' => 'LEGAL', 'name' => 'Legal Unit'],
            ['id' => 'off-ict', 'code' => 'ICT', 'name' => 'Information & Communications Technology Unit'],
        ];

        foreach ($offices as $office) {
            Office::query()->updateOrCreate(['id' => $office['id']], [...$office, 'is_custom' => false]);
        }

        $schools = [
            [
                'id' => 'sch-110001',
                'deped_school_id' => '110001',
                'name' => 'North District Branch',
                'district' => 'North District',
                'municipality' => 'Metro Central',
            ],
            [
                'id' => 'sch-301002',
                'deped_school_id' => '301002',
                'name' => 'East Regional Branch',
                'district' => 'East District',
                'municipality' => 'Metro East',
            ],
        ];

        foreach ($schools as $school) {
            School::query()->updateOrCreate(['id' => $school['id']], $school);
        }

        $passwordHash = Hash::make(self::DEV_DEFAULT_PASSWORD);
        $personnel = [
            [
                'id' => 'usr-records-1',
                'employee_id' => 'TRC-0101',
                'full_name' => 'Clarissa Mendoza',
                'position' => 'Administrative Officer IV (Records)',
                'office_id' => 'off-records',
                'role' => 'records_officer',
                'email' => 'records@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-budget-1',
                'employee_id' => 'TRC-0204',
                'full_name' => 'Marco Villareal',
                'position' => 'Budget Officer II',
                'office_id' => 'off-budget',
                'role' => 'unit_head',
                'email' => 'budget@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-budget-2',
                'employee_id' => 'TRC-0208',
                'full_name' => 'Teresa Bautista',
                'position' => 'Administrative Assistant III (Budget)',
                'office_id' => 'off-budget',
                'role' => 'staff',
                'email' => 'teresa.bautista@tracely.app',
                'availability' => 'on_leave',
                'delegate_id' => 'usr-budget-1',
            ],
            [
                'id' => 'usr-sgod-1',
                'employee_id' => 'TRC-0312',
                'full_name' => 'Rafael Manalo',
                'position' => 'Operations Lead',
                'office_id' => 'off-sgod',
                'role' => 'unit_head',
                'email' => 'ops@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-hr-1',
                'employee_id' => 'TRC-0419',
                'full_name' => 'Lourdes Navarro',
                'position' => 'Administrative Officer IV (HRMO)',
                'office_id' => 'off-hr',
                'role' => 'unit_head',
                'email' => 'hr@tracely.app',
                'availability' => 'official_business',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-legal-1',
                'employee_id' => 'TRC-0502',
                'full_name' => 'Atty. Noel Pangilinan',
                'position' => 'Attorney III (Legal Unit)',
                'office_id' => 'off-legal',
                'role' => 'legal_officer',
                'email' => 'legal@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-osds-1',
                'employee_id' => 'TRC-0001',
                'full_name' => 'Dr. Elena Magbanua',
                'position' => 'Executive Director',
                'office_id' => 'off-osds',
                'role' => 'unit_head',
                'email' => 'exec@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-acct-1',
                'employee_id' => 'TRC-0611',
                'full_name' => 'Danilo Reyes',
                'position' => 'Accountant III',
                'office_id' => 'off-acct',
                'role' => 'unit_head',
                'email' => 'acct@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
            [
                'id' => 'usr-ict-1',
                'employee_id' => 'TRC-0801',
                'full_name' => 'Arvin Soriano',
                'position' => 'Information Technology Officer I',
                'office_id' => 'off-ict',
                'role' => 'ict_admin',
                'email' => 'ict@tracely.app',
                'availability' => 'available',
                'delegate_id' => null,
            ],
        ];

        foreach ($personnel as $person) {
            User::query()->updateOrCreate(['id' => $person['id']], [
                ...$person,
                'active' => true,
                'approval_status' => 'approved',
                'email_verified_at' => now(),
                'password' => $passwordHash,
            ]);
        }

        $categories = [
            [
                'id' => 'cat-1',
                'name' => 'MOOE Liquidation & Cash Advance',
                'code' => 'MOOE-LIQ',
                'declared_by_office_code' => 'ACCT',
                'declared_by_office_name' => 'Accounting Unit',
                'usage_count' => 48,
                'is_verified_global' => true,
            ],
            [
                'id' => 'cat-2',
                'name' => 'Facilities & Maintenance Request',
                'code' => 'FAC-REQ',
                'declared_by_office_code' => 'OPS',
                'declared_by_office_name' => 'Operations & Facilities Unit',
                'usage_count' => 31,
                'is_verified_global' => true,
            ],
            [
                'id' => 'cat-3',
                'name' => 'Authority to Travel (Local)',
                'code' => 'TRAV-LOC',
                'declared_by_office_code' => 'RECORDS',
                'declared_by_office_name' => 'Records & Registry',
                'usage_count' => 64,
                'is_verified_global' => true,
            ],
        ];

        foreach ($categories as $category) {
            DocumentCategory::query()->updateOrCreate(['id' => $category['id']], $category);
        }

        $slaPolicies = [
            [
                'id' => 'sla-cat-1',
                'category_id' => 'cat-1',
                'target_hours' => 36,
                'stalled_alert_hours' => 18,
                'escalation_hours' => 36,
                'escalate_to_office_id' => 'off-osds',
                'active' => true,
            ],
            [
                'id' => 'sla-cat-2',
                'category_id' => 'cat-2',
                'target_hours' => 48,
                'stalled_alert_hours' => 24,
                'escalation_hours' => 48,
                'escalate_to_office_id' => 'off-osds',
                'active' => true,
            ],
            [
                'id' => 'sla-cat-3',
                'category_id' => 'cat-3',
                'target_hours' => 24,
                'stalled_alert_hours' => 12,
                'escalation_hours' => 24,
                'escalate_to_office_id' => 'off-osds',
                'active' => true,
            ],
        ];

        foreach ($slaPolicies as $policy) {
            SlaPolicy::query()->updateOrCreate(['id' => $policy['id']], $policy);
        }

        $sampleDocs = [
            [
                'doc' => [
                    'id' => 'doc-142',
                    'tracking_code' => 'TRC-2026-000142',
                    'qr_token' => '9f4a8b12c7e04a3d91f2a77c8d04142a',
                    'title' => 'Q4 Facilities Maintenance & Repair Funding Request',
                    'category_id' => 'cat-2',
                    'confidentiality_tier' => 'standard_internal',
                    'lifecycle_status' => 'in_transit',
                    'copy_format' => 'digital',
                    'sla_due_at' => now()->addHours(3),
                    'origin_office_id' => 'off-sgod',
                    'origin_user_id' => 'usr-sgod-1',
                    'current_office_id' => 'off-budget',
                    'current_holder_id' => 'usr-budget-1',
                    'submitted_school_id' => 'sch-110001',
                ],
                'participants' => ['usr-sgod-1', 'usr-budget-1'],
                'version' => [
                    'id' => 'ver-142-1',
                    'file_name' => 'drrm_repair_endorsement_v1.pdf',
                    'uploaded_by_id' => 'usr-sgod-1',
                    'uploaded_at' => now()->subHours(18),
                    'revision_note' => 'Endorsed program of works & school inspection sheet',
                    'storage_key' => 'docs/doc-142/v1.pdf',
                ],
                'tx' => [
                    'id' => 'tx-142-1',
                    'from_user_id' => 'usr-sgod-1',
                    'from_office_id' => 'off-sgod',
                    'to_user_id' => 'usr-budget-1',
                    'to_office_id' => 'off-budget',
                    'routing_scope' => 'inter_office',
                    'receipt_status' => 'pending',
                    'remarks' => 'For allotment availability verification and ORS preparation.',
                    'is_internal_only' => true,
                    'sent_at' => now()->subHours(2),
                ],
                'milestones' => [
                    [
                        'id' => 'ms-142-1',
                        'stage_label' => 'Registered at OPS',
                        'office_name' => 'Operations & Facilities Unit',
                        'occurred_at' => now()->subHours(18),
                    ],
                    [
                        'id' => 'ms-142-2',
                        'stage_label' => 'Routed to BUDGET',
                        'office_name' => 'Budget Unit',
                        'occurred_at' => now()->subHours(2),
                    ],
                ],
            ],
            [
                'doc' => [
                    'id' => 'doc-138',
                    'tracking_code' => 'TRC-2026-000138',
                    'qr_token' => '4b7c2d81e5a1492f88c3b910e21138bc',
                    'title' => 'Quarterly Field Operations Travel Order',
                    'category_id' => 'cat-3',
                    'confidentiality_tier' => 'standard_internal',
                    'lifecycle_status' => 'in_transit',
                    'copy_format' => 'digital',
                    'sla_due_at' => now()->addHours(22),
                    'origin_office_id' => 'off-records',
                    'origin_user_id' => 'usr-records-1',
                    'current_office_id' => 'off-sgod',
                    'current_holder_id' => 'usr-sgod-1',
                    'submitted_school_id' => null,
                ],
                'participants' => ['usr-records-1', 'usr-sgod-1'],
                'version' => [
                    'id' => 'ver-138-1',
                    'file_name' => 'travel_order_batch_04_v1.pdf',
                    'uploaded_by_id' => 'usr-records-1',
                    'uploaded_at' => now()->subHours(6),
                    'revision_note' => 'Initial batch logged at Records desk',
                    'storage_key' => 'docs/doc-138/v1.pdf',
                ],
                'tx' => [
                    'id' => 'tx-138-1',
                    'from_user_id' => 'usr-records-1',
                    'from_office_id' => 'off-records',
                    'to_user_id' => 'usr-sgod-1',
                    'to_office_id' => 'off-sgod',
                    'routing_scope' => 'inter_office',
                    'receipt_status' => 'pending',
                    'remarks' => 'Please review attached itinerary before Executive endorsement.',
                    'is_internal_only' => true,
                    'sent_at' => now()->subHour(),
                ],
                'milestones' => [
                    [
                        'id' => 'ms-138-1',
                        'stage_label' => 'Registered at RECORDS',
                        'office_name' => 'Records & Registry',
                        'occurred_at' => now()->subHours(6),
                    ],
                    [
                        'id' => 'ms-138-2',
                        'stage_label' => 'Routed to OPS',
                        'office_name' => 'Operations & Facilities Unit',
                        'occurred_at' => now()->subHour(),
                    ],
                ],
            ],
            [
                'doc' => [
                    'id' => 'doc-115',
                    'tracking_code' => 'TRC-2026-000115',
                    'qr_token' => '1c60a922f1b34b8a9910e4a8c32115ef',
                    'title' => 'Staff Reclassification & Service Record Endorsement',
                    'category_id' => 'cat-1',
                    'confidentiality_tier' => 'restricted',
                    'lifecycle_status' => 'in_review',
                    'copy_format' => 'digital',
                    'sla_due_at' => now()->addHours(36),
                    'origin_office_id' => 'off-records',
                    'origin_user_id' => 'usr-records-1',
                    'current_office_id' => 'off-budget',
                    'current_holder_id' => 'usr-budget-1',
                    'submitted_school_id' => 'sch-301002',
                ],
                'participants' => ['usr-records-1', 'usr-hr-1', 'usr-budget-1'],
                'version' => [
                    'id' => 'ver-115-1',
                    'file_name' => 'reclass_endorsement_pack_v1.pdf',
                    'uploaded_by_id' => 'usr-records-1',
                    'uploaded_at' => now()->subHours(24),
                    'revision_note' => 'Verified NOSCA and CSC evaluation checklist',
                    'storage_key' => 'docs/doc-115/v1.pdf',
                ],
                'tx' => [
                    'id' => 'tx-115-1',
                    'from_user_id' => 'usr-hr-1',
                    'from_office_id' => 'off-hr',
                    'to_user_id' => 'usr-budget-1',
                    'to_office_id' => 'off-budget',
                    'routing_scope' => 'inter_office',
                    'receipt_status' => 'acknowledged',
                    'remarks' => 'Verified HR plantilla slot; endorsed to Budget.',
                    'is_internal_only' => true,
                    'sent_at' => now()->subHours(10),
                    'acknowledged_at' => now()->subHours(9),
                    'acknowledged_by_name' => 'Marco Villareal',
                ],
                'milestones' => [
                    [
                        'id' => 'ms-115-1',
                        'stage_label' => 'Registered at RECORDS',
                        'office_name' => 'Records & Registry',
                        'occurred_at' => now()->subHours(24),
                    ],
                    [
                        'id' => 'ms-115-2',
                        'stage_label' => 'Received by BUDGET',
                        'office_name' => 'Budget Unit',
                        'occurred_at' => now()->subHours(9),
                    ],
                ],
            ],
        ];

        foreach ($sampleDocs as $entry) {
            $docData = $entry['doc'];
            $doc = Document::query()->updateOrCreate(['id' => $docData['id']], $docData);
            $doc->participants()->sync($entry['participants']);

            $v = $entry['version'];
            $pdfBytes = $this->samplePdfBytes($docData['tracking_code'], $docData['title']);
            Storage::disk('local')->put($v['storage_key'], $pdfBytes);

            DocumentVersion::query()->updateOrCreate(['id' => $v['id']], [
                'id' => $v['id'],
                'document_id' => $doc->id,
                'version_number' => 1,
                'file_name' => $v['file_name'],
                'mime_type' => 'application/pdf',
                'size_bytes' => strlen($pdfBytes),
                'sha256_checksum' => hash('sha256', $pdfBytes),
                'uploaded_by_id' => $v['uploaded_by_id'],
                'uploaded_at' => $v['uploaded_at'],
                'revision_note' => $v['revision_note'],
                'storage_key' => $v['storage_key'],
            ]);

            $tx = $entry['tx'];
            RoutingTransaction::query()->updateOrCreate(['id' => $tx['id']], [
                ...$tx,
                'document_id' => $doc->id,
            ]);

            foreach ($entry['milestones'] as $ms) {
                ExternalMilestone::query()->updateOrCreate(['id' => $ms['id']], [
                    ...$ms,
                    'document_id' => $doc->id,
                ]);
            }
        }

        UserNotification::query()->updateOrCreate(['id' => 'notif-142'], [
            'id' => 'notif-142',
            'target_user_id' => 'usr-budget-1',
            'target_office_id' => 'off-budget',
            'document_id' => 'doc-142',
            'title' => 'Sealed QR Incoming · From OPS',
            'content' => 'OPS (Rafael Manalo) sent a sealed document transfer. Tap to open the QR Scanner and scan the sender routing QR code to unlock and access it.',
            'lock_screen_preview' => 'New sealed QR transfer waiting to be scanned in Tracely.',
            'authenticated_detail' => 'Sealed transfer from OPS · Scan sender routing QR to unlock',
            'received_at' => now()->subHours(2),
            'read' => false,
        ]);

        AuditLog::query()->updateOrCreate(['id' => 'aud-seed-1'], [
            'id' => 'aud-seed-1',
            'actor_id' => 'usr-sgod-1',
            'actor_name' => 'Rafael Manalo',
            'actor_office_code' => 'OPS',
            'action' => 'forwarded',
            'document_id' => 'doc-142',
            'tracking_code' => 'TRC-2026-000142',
            'summary' => 'Forwarded TRC-2026-000142 to BUDGET (Marco Villareal)',
            'device_label' => 'Seed Workstation',
            'occurred_at' => now()->subHours(2),
        ]);
    }

    private function samplePdfBytes(string $trackingCode, string $title): string
    {
        $cleanTitle = preg_replace('/[^\x20-\x7E]/', '', $title) ?: $trackingCode;
        $stream = "BT /F1 12 Tf 40 740 Td (Tracely - {$trackingCode}) Tj 0 -22 Td ({$cleanTitle}) Tj ET";
        $len = strlen($stream);

        return "%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n"
            ."2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n"
            ."3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
            ."4 0 obj<< /Length {$len} >>stream\n{$stream}\nendstream\nendobj\n"
            ."5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n"
            ."xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000241 00000 n \n0000000350 00000 n \n"
            ."trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n420\n%%EOF\n";
    }
}
