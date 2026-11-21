import XCTest
@testable import Dadog

final class ConversationTests: XCTestCase {
    func testPersistenceAndUnsupportedVersion() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString).appendingPathComponent("archive.json")
        defer { try? FileManager.default.removeItem(at: url.deletingLastPathComponent()) }
        let store = LocalConversationStorage(url: url)
        let original = [Conversation(title: "Test", entries: [Entry(text: "hello")])]
        try store.save(original)
        XCTAssertEqual(try store.load(), original)
        try Data("{\"version\":2,\"conversations\":[]}".utf8).write(to: url)
        XCTAssertThrowsError(try store.load())
    }

    @MainActor func testSaveFailureKeepsPriorState() {
        struct Failing: ConversationStorage {
            func load() throws -> [Conversation] { [] }
            func save(_ conversations: [Conversation]) throws { throw CocoaError(.fileWriteOutOfSpace) }
        }
        let model = ConversationModel(storage: Failing())
        XCTAssertNil(model.create())
        XCTAssertTrue(model.conversations.isEmpty)
        XCTAssertNotNil(model.error)
    }

    @MainActor func testLoadFailureDoesNotOverwrite() {
        struct Broken: ConversationStorage {
            func load() throws -> [Conversation] { throw CocoaError(.fileReadCorruptFile) }
            func save(_ conversations: [Conversation]) throws { XCTFail("Must not overwrite unreadable data") }
        }
        let model = ConversationModel(storage: Broken())
        XCTAssertFalse(model.canWrite)
        XCTAssertNil(model.create())
    }
}

