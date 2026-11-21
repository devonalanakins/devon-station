# Dadog for iPhone — local capture slice

Source-only companion to the existing Dadog/DevonStation work. Create and rename local conversations, save notes, share a text export, and confirm deletion. There is no assistant connection, sync, model, credential, analytics or access to other systems. A portable `AssistantService` protocol reserves a boundary for later approved work; it is not wired to a provider. Notes are not represented as sent messages. An unfinished composer is held only while its screen remains open.

The JSON archive is versioned and writes atomically with iOS complete file protection. A load failure disables writes so a corrupt or newer archive is not silently replaced. Export is a deliberate system share operation; exported copies and OS backups can persist after deletion. Protection, backup behavior, interruption and data recovery still require device testing. No secure-erasure claim is made.

## Run on a Mac

Install Xcode and XcodeGen, run `xcodegen generate`, open `Dadog.xcodeproj`, select an iPhone simulator, and run the Dadog scheme. Run its test action for the unit tests. A physical device requires appropriate local signing; the placeholder bundle identifier is not a registered distribution identity. Use synthetic data until device behavior and privacy have been validated.

## Status

This Windows environment has no Xcode, iOS SDK or Swift compiler. The project has not been generated, compiled, run, visually reviewed or tested on a simulator or device. XcodeGen and iOS 17 are initial project choices to validate, not proof of compatibility. No App Store or TestFlight release or Apple Developer enrollment is implied. Before release, test persistence, file protection while locked, interrupted writes, low storage, export/deletion, VoiceOver, Dynamic Type and physical-device behavior; add approved integration only with a separate data and authority review.

