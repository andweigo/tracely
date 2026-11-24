<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_pending_registration_status_transitions_from_pending_to_approved_and_rejected(): void
    {
        $regApprove = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Miguel Santos',
            'employee_id' => 'TRC-9301',
            'email' => 'miguel.santos@tracely.app',
            'position' => 'Administrative Assistant II',
            'office_code' => 'BUDGET',
            'password' => 'Tracely#2026!',
        ])->assertCreated()
            ->assertJsonPath('pending_approval', true)
            ->assertJsonPath('approval_status', 'pending')
            ->assertJsonPath('submitted.employee_id', 'TRC-9301')
            ->assertJsonPath('submitted.office_code', 'BUDGET');

        $approveToken = (string) $regApprove->json('status_token');
        $this->assertNotEmpty($approveToken);

        // Unauthenticated status check returns pending while waiting
        $this->getJson('/api/v1/auth/registration-status/'.$approveToken)
            ->assertOk()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('can_sign_in', false)
            ->assertJsonPath('submitted.email', 'miguel.santos@tracely.app');

        // Login attempt while pending returns 403 with ACCOUNT_PENDING_APPROVAL and a fresh status token
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'miguel.santos@tracely.app',
            'password' => 'Tracely#2026!',
        ])->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL')
            ->assertJsonPath('approval_status', 'pending')
            ->assertJsonPath('submitted.employee_id', 'TRC-9301');

        // Register a second account that will be rejected
        $regReject = $this->postJson('/api/v1/auth/register', [
            'full_name' => 'Rejected Applicant',
            'employee_id' => 'TRC-9302',
            'email' => 'rejected.applicant@tracely.app',
            'position' => 'Clerk I',
            'office_code' => 'OPS',
            'password' => 'Tracely#2026!',
        ])->assertCreated();
        $rejectToken = (string) $regReject->json('status_token');

        $ictAdmin = User::query()->where('email', 'ict@tracely.app')->firstOrFail();
        $approveUser = User::query()->where('employee_id', 'TRC-9301')->firstOrFail();
        $rejectUser = User::query()->where('employee_id', 'TRC-9302')->firstOrFail();

        $this->actingAs($ictAdmin, 'sanctum')
            ->postJson("/api/v1/admin/users/{$approveUser->id}/approve")
            ->assertOk();

        $this->actingAs($ictAdmin, 'sanctum')
            ->postJson("/api/v1/admin/users/{$rejectUser->id}/reject", ['reason' => 'Unverified ID'])
            ->assertOk();

        // Status endpoint reflects approved & rejected accurately
        $this->getJson('/api/v1/auth/registration-status/'.$approveToken)
            ->assertOk()
            ->assertJsonPath('status', 'approved')
            ->assertJsonPath('can_sign_in', true);

        $this->getJson('/api/v1/auth/registration-status/'.$rejectToken)
            ->assertOk()
            ->assertJsonPath('status', 'rejected')
            ->assertJsonPath('can_sign_in', false);

        // Login while rejected returns ACCOUNT_REJECTED
        $this->postJson('/api/v1/auth/login', [
            'identifier' => 'TRC-9302',
            'password' => 'Tracely#2026!',
        ])->assertStatus(403)
            ->assertJsonPath('code', 'ACCOUNT_REJECTED')
            ->assertJsonPath('approval_status', 'rejected');

        // Tampered token returns 404
        $this->getJson('/api/v1/auth/registration-status/tampered.deadbeef')
            ->assertNotFound()
            ->assertJsonPath('code', 'INVALID_STATUS_TOKEN');
    }
}
