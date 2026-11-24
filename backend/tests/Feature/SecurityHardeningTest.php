<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        Cache::flush();
    }

    public function test_security_headers_and_oversized_json_body_rejection(): void
    {
        $health = $this->getJson('/api/v1/health');
        $health->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Reject oversized non-multipart API request early with 413
        $oversized = $this->postJson('/api/v1/auth/login', [
            'identifier' => 'records@tracely.app',
            'password' => 'Tracely@2026!',
            'padding' => str_repeat('A', 2_200_000),
        ]);

        $oversized->assertStatus(413)
            ->assertJsonPath('code', 'PAYLOAD_TOO_LARGE');
    }

    public function test_admin_login_is_rate_limited_against_brute_force(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->post('/admin/login', [
                'identifier' => 'ict@tracely.app',
                'password' => 'WrongPass!'.$i,
            ])->assertStatus(302);
        }

        // 6th rapid attempt on the same account+IP must be throttled with 429
        $this->post('/admin/login', [
            'identifier' => 'ict@tracely.app',
            'password' => 'WrongPass!final',
        ])->assertStatus(429);
    }

    public function test_audit_log_hash_chain_links_entries_and_detects_tampering(): void
    {
        $actor = User::query()->where('email', 'records@tracely.app')->firstOrFail();
        $logger = app(AuditLogger::class);

        $first = $logger->record($actor, 'doc_created', 'doc-1', 'TRC-2026-001', 'Created document.');
        $second = $logger->record($actor, 'doc_forwarded', 'doc-1', 'TRC-2026-001', 'Forwarded document.');

        $this->assertNotNull($first->entry_hash);
        $this->assertSame($first->entry_hash, $second->prev_hash);
        $this->assertNotSame($first->entry_hash, $second->entry_hash);

        $cleanAudit = $logger->verifyChain();
        $this->assertTrue($cleanAudit['supported']);
        $this->assertTrue($cleanAudit['valid']);
        $this->assertSame([], $cleanAudit['broken_ids']);

        // Tamper directly with DB summary and verify chain audit catches it
        AuditLog::query()->where('id', $first->id)->update(['summary' => 'Tampered summary']);

        $tamperedAudit = $logger->verifyChain();
        $this->assertFalse($tamperedAudit['valid']);
        $this->assertContains($first->id, $tamperedAudit['broken_ids']);
    }

    public function test_sse_stream_enforces_concurrent_capacity_cap(): void
    {
        $actor = User::query()->where('email', 'records@tracely.app')->firstOrFail();

        // Simulate user already holding maximum concurrent SSE connections
        Cache::put("tracely:sse:user:{$actor->id}", 2, now()->addSeconds(60));

        $this->actingAs($actor, 'sanctum')
            ->getJson('/api/v1/events/stream')
            ->assertStatus(429)
            ->assertJsonPath('code', 'STREAM_CAPACITY_REACHED')
            ->assertJsonPath('fallback_transport', 'live_pulse');
    }
}
