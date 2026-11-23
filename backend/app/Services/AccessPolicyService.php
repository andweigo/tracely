<?php

namespace App\Services;

use App\Exceptions\ApiDomainException;
use App\Models\Document;
use App\Models\User;

class AccessPolicyService
{
    /**
     * @return array{allowed: bool, code: string, reason: string}
     */
    public function authorizeFullCustody(User $actor, Document $document): array
    {
        if (! $actor->active || $actor->approval_status !== 'approved') {
            return [
                'allowed' => false,
                'code' => 'ACCOUNT_INACTIVE',
                'reason' => 'Deactivated or unapproved accounts cannot access documents.',
            ];
        }

        return match ($document->confidentiality_tier) {
            'confidential' => $document->isParticipant($actor->id)
                ? [
                    'allowed' => true,
                    'code' => 'AUTHORIZED',
                    'reason' => 'Authorized as explicit participant of Confidential document.',
                ]
                : [
                    'allowed' => false,
                    'code' => 'CONFIDENTIAL_CUSTODY_DENIED',
                    'reason' => 'Confidential records are strictly limited to explicitly named custodians and participants.',
                ],

            'restricted' => ($document->isParticipant($actor->id)
                || ($actor->role === 'unit_head' && $document->involvesOffice($actor->office_id)))
                ? [
                    'allowed' => true,
                    'code' => 'AUTHORIZED',
                    'reason' => 'Authorized for Restricted document.',
                ]
                : [
                    'allowed' => false,
                    'code' => 'RESTRICTED_SCOPE_DENIED',
                    'reason' => 'Restricted documents require direct assignment or Unit Head custody in an involved office.',
                ],

            default => ($document->involvesOffice($actor->office_id) || $actor->role === 'records_officer')
                ? [
                    'allowed' => true,
                    'code' => 'AUTHORIZED',
                    'reason' => 'Authorized under Standard Internal office/records scope.',
                ]
                : [
                    'allowed' => false,
                    'code' => 'OFFICE_SCOPE_DENIED',
                    'reason' => 'Document is outside your office routing chain.',
                ],
        };
    }

    public function enforceFullCustody(User $actor, Document $document): void
    {
        $decision = $this->authorizeFullCustody($actor, $document);
        if (! $decision['allowed']) {
            throw new ApiDomainException($decision['code'], $decision['reason'], 403);
        }
    }

    /**
     * Returns true when the document has an unacknowledged pending transfer directed to the
     * actor's office (and not sent by the actor), meaning the recipient must scan the routing
     * QR code or enter the code from the routing slip before viewing details, comments, or files.
     */
    public function requiresReceiptBeforeFileAccess(User $actor, Document $document): bool
    {
        $document->loadMissing('transactions');
        $latest = $document->latestTransaction();
        if (! $latest || $latest->receipt_status !== 'pending') {
            return false;
        }

        return $latest->canBeAcknowledgedBy($actor);
    }

    /**
     * Canonical check indicating whether a document must be delivered as a sealed QR envelope
     * to the given actor until they scan the sender's routing QR code and confirm receipt.
     */
    public function isSealedForActor(User $actor, Document $document): bool
    {
        return $this->requiresReceiptBeforeFileAccess($actor, $document);
    }

    /**
     * @return array{visibility: 'full_custody'|'location_only'|'denied', code: string, reason: string}
     */
    public function resolveTrackingVisibility(User $actor, Document $document): array
    {
        if (! $actor->active || $actor->approval_status !== 'approved') {
            return [
                'visibility' => 'denied',
                'code' => 'ACCOUNT_INACTIVE',
                'reason' => 'Deactivated accounts cannot track documents.',
            ];
        }

        $full = $this->authorizeFullCustody($actor, $document);
        if ($full['allowed']) {
            return [
                'visibility' => 'full_custody',
                'code' => $full['code'],
                'reason' => $full['reason'],
            ];
        }

        return match ($document->confidentiality_tier) {
            'confidential' => [
                'visibility' => 'denied',
                'code' => 'CONFIDENTIAL_TRACKING_DENIED',
                'reason' => 'Confidential records cannot be tracked by non-participants.',
            ],

            'restricted' => $document->involvesOffice($actor->office_id)
                ? [
                    'visibility' => 'location_only',
                    'code' => 'OFFICE_LOCATION_ONLY',
                    'reason' => 'Office staff can see current office location; PDFs and details are limited to Unit Head or direct participants.',
                ]
                : [
                    'visibility' => 'denied',
                    'code' => 'RESTRICTED_SCOPE_DENIED',
                    'reason' => 'Restricted documents are not visible outside involved offices.',
                ],

            default => [
                'visibility' => 'location_only',
                'code' => 'INTERNAL_LOCATION_ONLY',
                'reason' => 'Active personnel can view current office location without opening document contents.',
            ],
        };
    }
}
