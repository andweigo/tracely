# DepEd SDO Oriental Mindoro — DocsTrack Mobile (React Native Android)

Dedicated React Native (`0.88.1`) + TypeScript mobile companion app structured cleanly around the **Four Pillars of Object-Oriented Programming**.

## Clean Folder Architecture

```text
src/
├── domain/                  # Pure TypeScript OOP entities, enums & security policies (zero RN/DOM imports)
│   ├── base/                # BaseEntity (UUID identity + invariants), DomainRuleError
│   ├── enums/               # ConfidentialityTier, AvailabilityStatus, RoutingScope, ReceiptStatus, AuditAction
│   ├── entities/            # Personnel, Document, DocumentVersion, RoutingTransaction, DocumentCategory, School, OfflineAttachment, AuditLogEntry
│   └── security/            # AccessPolicy (Abstraction/Inheritance), QrPayload (Polymorphism), NativeImageSanitizer (pure-TS SHA-256 + EXIF strip metadata)
├── repositories/
│   ├── contracts/           # IDocumentRepository, IAuditRepository, ISecureTokenStore (Abstraction)
│   └── memory/              # Synthetic RA-10173-safe in-memory implementations
├── services/                # AuthSessionService, DocumentRoutingService, QrResolutionService, CategoryService, OfflineSyncService
├── state/                   # AppServiceContext (Constructor DI container -> React Native hooks)
├── data/                    # Strictly synthetic SDO Oriental Mindoro seed data (zero real PII)
└── ui/
    ├── theme/               # Design tokens (SDO_COLORS)
    ├── components/          # Badges, QrCodeGraphic (react-native-svg + qrcode), ModalSheet, EmptyState, SanitizedCaptureCard
    ├── layout/              # MobileShell (SafeAreaView + Header + Toast), BottomNav
    ├── screens/             # LoginScreen, InboxScreen, DocumentDetailScreen, ScannerScreen, CategoriesScreen, NotificationsScreen, ProfileScreen
    ├── sheets/              # AcknowledgeSheet, ForwardSheet, ActionRemarksSheet, CameraCaptureSheet, PresignedViewerModal, CategoryDeclareSheet, RevisionUploadSheet, AuditInspectorSheet
    └── utils/               # Hermes-safe date/byte formatters
```

## Run on Connected Android Device (`adb`)

```powershell
cd c:\docstrack\mobile
npm test
npx react-native run-android
```
