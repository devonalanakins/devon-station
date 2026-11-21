import Foundation
import Combine

struct Conversation: Codable, Identifiable, Equatable {
    var id = UUID()
    var title: String
    var entries: [Entry] = []
}

struct Entry: Codable, Identifiable, Equatable {
    var id = UUID()
    var text: String
    var createdAt = Date()
}

// A future adapter must be explicitly selected; this slice never sends data.
protocol AssistantService {
    func reply(to text: String) async throws -> String
}

protocol ConversationStorage {
    func load() throws -> [Conversation]
    func save(_ conversations: [Conversation]) throws
}

struct LocalConversationStorage: ConversationStorage {
    private struct Archive: Codable {
        var version: Int
        var conversations: [Conversation]
    }
    enum StorageError: Error { case unsupportedVersion }
    let url: URL

    func load() throws -> [Conversation] {
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        let archive = try JSONDecoder().decode(Archive.self, from: Data(contentsOf: url))
        guard archive.version == 1 else { throw StorageError.unsupportedVersion }
        return archive.conversations
    }

    func save(_ conversations: [Conversation]) throws {
        let data = try JSONEncoder().encode(Archive(version: 1, conversations: conversations))
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}

@MainActor final class ConversationModel: ObservableObject {
    @Published private(set) var conversations: [Conversation] = []
    @Published var error: String?
    private let storage: ConversationStorage
    private(set) var canWrite = false

    init(storage: ConversationStorage) {
        self.storage = storage
        do { conversations = try storage.load(); canWrite = true }
        catch { self.error = "Could not open local conversations. Existing data has not been overwritten." }
    }

    private func commit(_ next: [Conversation]) -> Bool {
        guard canWrite else { return false }
        do { try storage.save(next); conversations = next; error = nil; return true }
        catch { self.error = "Could not save. Your changes are still in the editor; try again."; return false }
    }

    func create() -> UUID? {
        let conversation = Conversation(title: "New conversation")
        return commit([conversation] + conversations) ? conversation.id : nil
    }
    func rename(_ id: UUID, title: String) -> Bool {
        let value = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, let index = conversations.firstIndex(where: { $0.id == id }) else { return false }
        var next = conversations; next[index].title = value
        return commit(next)
    }
    func add(_ id: UUID, text: String) -> Bool {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, let index = conversations.firstIndex(where: { $0.id == id }) else { return false }
        var next = conversations; next[index].entries.append(Entry(text: value))
        return commit(next)
    }
    func delete(_ id: UUID) -> Bool { commit(conversations.filter { $0.id != id }) }
}

