<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiDomainException;
use App\Http\Controllers\Controller;
use App\Models\DocumentCategory;
use App\Models\Office;
use App\Models\RoutingTemplate;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RealtimeEventHub;
use App\Support\DtoSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoutingTemplateController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $templates = RoutingTemplate::query()
            ->with(['office', 'creator', 'category'])
            ->where(function ($q) use ($actor): void {
                $q->where('is_global', true)
                    ->orWhere('office_id', $actor->office_id);
            })
            ->orderByDesc('is_global')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $templates->map(fn (RoutingTemplate $tpl) => DtoSerializer::routingTemplate($tpl))->values()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'description' => ['nullable', 'string', 'max:240'],
            'category_id' => ['nullable', 'string', 'max:64'],
            'is_global' => ['nullable', 'boolean'],
            'steps' => ['required', 'array', 'min:1', 'max:12'],
            'steps.*.office_id' => ['required', 'string', 'max:64'],
            'steps.*.default_remarks' => ['nullable', 'string', 'max:160'],
        ]);

        $categoryId = null;
        if (! empty($validated['category_id'])) {
            $cat = DocumentCategory::query()->find($validated['category_id']);
            if (! $cat) {
                throw new ApiDomainException('INVALID_CATEGORY', 'Selected category does not exist.', 422);
            }
            $categoryId = $cat->id;
        }

        $officeIds = collect($validated['steps'])->pluck('office_id')->unique()->values()->all();
        $offices = Office::query()->whereIn('id', $officeIds)->get()->keyBy('id');

        $normalizedSteps = [];
        foreach ($validated['steps'] as $idx => $step) {
            /** @var Office|null $office */
            $office = $offices->get($step['office_id']);
            if (! $office) {
                throw new ApiDomainException('INVALID_OFFICE', 'One or more routing step offices were not found.', 422);
            }
            $normalizedSteps[] = [
                'order' => $idx + 1,
                'office_id' => $office->id,
                'office_code' => $office->code,
                'office_name' => $office->name,
                'default_remarks' => trim((string) ($step['default_remarks'] ?? '')),
            ];
        }

        $canPublishGlobal = in_array($actor->role, ['ict_admin', 'records_officer', 'unit_head'], true);
        $isGlobal = $canPublishGlobal && (bool) ($validated['is_global'] ?? false);

        $template = RoutingTemplate::query()->create([
            'id' => 'tpl-'.Str::uuid()->toString(),
            'name' => trim($validated['name']),
            'description' => trim((string) ($validated['description'] ?? '')) ?: null,
            'category_id' => $categoryId,
            'office_id' => $actor->office_id,
            'created_by_user_id' => $actor->id,
            'steps_json' => $normalizedSteps,
            'is_global' => $isGlobal,
        ]);

        $this->audit->record(
            $actor,
            'routing_template_created',
            null,
            null,
            "Created routing template \"{$template->name}\" (".count($normalizedSteps).' step(s)).',
        );
        $this->realtime->publish('routing_template_updated', [$actor->office_id], [$actor->id]);

        return response()->json([
            'data' => DtoSerializer::routingTemplate($template->fresh(['office', 'creator', 'category'])),
        ], 201);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $template = RoutingTemplate::query()->findOrFail($id);
        $isPrivileged = in_array($actor->role, ['ict_admin', 'records_officer'], true)
            || ($actor->role === 'unit_head' && $template->office_id === $actor->office_id);

        if ($template->created_by_user_id !== $actor->id && ! $isPrivileged) {
            throw new ApiDomainException(
                'TEMPLATE_DELETE_FORBIDDEN',
                'Only the template creator or an office head / administrator can delete this routing template.',
                403,
            );
        }

        $name = $template->name;
        $officeId = $template->office_id;
        $template->delete();

        $this->audit->record(
            $actor,
            'routing_template_deleted',
            null,
            null,
            "Deleted routing template \"{$name}\".",
        );
        $this->realtime->publish('routing_template_updated', [$officeId], [$actor->id]);

        return response()->json(['deleted' => true, 'id' => $id]);
    }
}
