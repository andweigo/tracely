<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class MobileReleaseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        File::deleteDirectory(storage_path('app/public/downloads'));
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(storage_path('app/public/downloads'));
        parent::tearDown();
    }

    public function test_ict_admin_can_publish_apk_and_public_download_serves_it(): void
    {
        // Before publication, APK returns 404 and landing page renders unavailable state
        $this->get('/download')->assertOk()->assertSee('not published yet');
        $this->get('/download/tracely.apk')->assertNotFound();

        $staff = User::query()->where('email', 'records@tracely.app')->firstOrFail();
        $ictAdmin = User::query()->where('email', 'ict@tracely.app')->firstOrFail();

        $fakeApkBytes = "PK\x03\x04" . str_repeat('T', 512);
        $validApk = UploadedFile::fake()->createWithContent('app-release.apk', $fakeApkBytes);

        // Non-ICT users are blocked from publishing APK releases
        $this->actingAs($staff, 'sanctum')
            ->post('/api/v1/admin/mobile-release', [
                'apk' => $validApk,
                'version' => '1.0.0',
            ])
            ->assertForbidden();

        // Invalid non-ZIP file is rejected
        $badApk = UploadedFile::fake()->createWithContent('bad.apk', 'NOT_A_ZIP');
        $this->actingAs($ictAdmin, 'sanctum')
            ->post('/api/v1/admin/mobile-release', [
                'apk' => $badApk,
                'version' => '1.0.0',
            ])
            ->assertStatus(422);

        // ICT Admin publishes valid APK
        $publishResponse = $this->actingAs($ictAdmin, 'sanctum')
            ->post('/api/v1/admin/mobile-release', [
                'apk' => UploadedFile::fake()->createWithContent('tracely-release.apk', $fakeApkBytes),
                'version' => '1.0.0',
                'notes' => 'Initial Railway production release',
            ]);

        $publishResponse
            ->assertCreated()
            ->assertJsonPath('status', 'published')
            ->assertJsonPath('release.version', '1.0.0')
            ->assertJsonPath('release.sha256', hash('sha256', $fakeApkBytes));

        // Download landing page shows ready state and download CTA without exposing Cloud API URL, SHA-256, or Admin Portal
        $this->get('/download')
            ->assertOk()
            ->assertSee('Download Tracely APK (v1.0.0)')
            ->assertSee('/download/tracely.apk')
            ->assertDontSee('Cloud API')
            ->assertDontSee('SHA-256')
            ->assertDontSee('Admin Portal')
            ->assertDontSee('/admin/login')
            ->assertDontSee(substr(hash('sha256', $fakeApkBytes), 0, 24));

        // Direct APK download serves Android package MIME type and exact bytes
        $downloadResponse = $this->get('/download/tracely.apk');
        $downloadResponse
            ->assertOk()
            ->assertHeader('Content-Type', 'application/vnd.android.package-archive');
        $this->assertSame($fakeApkBytes, $downloadResponse->streamedContent());
    }
}
