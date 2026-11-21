import SwiftUI

@main struct DadogApp: App {
    @StateObject private var model: ConversationModel
    init() {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        _model = StateObject(wrappedValue: ConversationModel(storage: LocalConversationStorage(url: base.appendingPathComponent("Dadog/conversations.json"))))
    }
    var body: some Scene { WindowGroup { ConversationList().environmentObject(model) } }
}

struct ConversationList: View {
    @EnvironmentObject private var model: ConversationModel
    @State private var selected: UUID?
    @State private var toDelete: UUID?
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Saved on this device. No assistant service is connected; nothing is sent.")
                        .font(.subheadline).foregroundStyle(.secondary)
                    if let error = model.error { Text(error).foregroundStyle(.red) }
                }
                Section("Conversations") {
                    ForEach(model.conversations) { conversation in
                        NavigationLink(value: conversation.id) {
                            VStack(alignment: .leading) {
                                Text(conversation.title).font(.headline)
                                Text("\(conversation.entries.count) saved notes").font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .swipeActions { Button("Delete", role: .destructive) { toDelete = conversation.id } }
                    }
                }
            }
            .navigationTitle("Dadog")
            .toolbar { Button("New", systemImage: "plus") { selected = model.create() }.disabled(!model.canWrite) }
            .navigationDestination(for: UUID.self) { ConversationDetail(id: $0) }
            .navigationDestination(item: $selected) { ConversationDetail(id: $0) }
            .confirmationDialog("Delete this conversation?", isPresented: Binding(get: { toDelete != nil }, set: { if !$0 { toDelete = nil } })) {
                Button("Delete conversation", role: .destructive) { if let id = toDelete { _ = model.delete(id) }; toDelete = nil }
            } message: { Text("This removes the local copy. Exports and backups may remain.") }
        }
    }
}

struct ConversationDetail: View {
    @EnvironmentObject private var model: ConversationModel
    let id: UUID
    @State private var draft = ""
    @State private var title = ""
    @State private var renaming = false
    private var conversation: Conversation? { model.conversations.first { $0.id == id } }
    private var exportText: String {
        guard let conversation else { return "" }
        return ([conversation.title, ""] + conversation.entries.map { $0.text }).joined(separator: "\n\n")
    }
    var body: some View {
        VStack {
            if let conversation {
                List {
                    if let error = model.error { Text(error).foregroundStyle(.red) }
                    ForEach(conversation.entries) { entry in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.text).textSelection(.enabled)
                            Text(entry.createdAt, style: .date).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                VStack(alignment: .leading) {
                    Text("Local note · no assistant connected").font(.caption).foregroundStyle(.secondary)
                    TextField("Capture a thought", text: $draft, axis: .vertical).textFieldStyle(.roundedBorder)
                    Button("Save note") { if model.add(id, text: draft) { draft = "" } }
                        .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !model.canWrite)
                }.padding()
            } else { ContentUnavailableView("Conversation unavailable", systemImage: "text.bubble") }
        }
        .navigationTitle(conversation?.title ?? "Conversation")
        .toolbar {
            if let conversation {
                Menu("More", systemImage: "ellipsis.circle") {
                    Button("Rename") { title = conversation.title; renaming = true }
                    ShareLink(item: exportText, subject: Text(conversation.title)) { Label("Export text", systemImage: "square.and.arrow.up") }
                }
            }
        }
        .alert("Rename conversation", isPresented: $renaming) {
            TextField("Title", text: $title)
            Button("Cancel", role: .cancel) { }
            Button("Save") { _ = model.rename(id, title: title) }
        }
    }
}

