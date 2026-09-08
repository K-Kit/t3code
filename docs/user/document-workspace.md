# Working in Workspace

Workspace brings together ongoing chats, working files, and saved documents. Create a named workspace, then start a conversation from **Chats**. Choose an AI account in the chat and send your request. Conversations stay in that workspace; use chat search to find them later. Task starters prepare a request for research, file work, or planning, which you can edit before sending. Available tools and connected services depend on the selected provider.

**Files** shows the files in the selected workspace's folder. Ask your assistant to create or work with files, then browse the results there. Select a file and choose **Discuss in chat** to start a conversation about it. Text previews may be shortened; the assistant works with the underlying file. A managed document can also be sent to a new chat using **Discuss in chat**; this includes its saved text as reference material without sending the message automatically.

## Research and connected apps

Open **Research**, choose an AI account and model, and enter your question. You can add source URLs, choose a briefing, comparison or report, and select up to five connected apps. **Prepare research chat** creates an editable request; review it before sending. The request asks the assistant to cite evidence, distinguish uncertainty, and gather information without changing connected services. Its actual tools and permissions come from the selected provider.

**Apps** shows the selected account's live app catalog and runtime availability. Codex supports this catalog first; other providers may have configured tools without exposing them here. **Ready to use** means the provider currently reports callable tools for that app. Connection links open the provider's own connection flow; Workspace does not collect third-party passwords. Return and refresh after connecting. Account access can change, so a saved selection does not guarantee a later tool call will succeed.

The Research and Apps screens are currently available in web and desktop. You can continue their resulting conversations on mobile.

## Working with documents

Choose **Documents**, then **New document** or **Import documents**. Imports make a managed copy. Changing a document in Workspace does not change the file you originally selected.

Workspace supports UTF-8 text, Markdown, basic Word documents and PDFs containing readable text. Files must be at most 20 MB; PDF imports are limited to 200 pages and editable content to 500,000 characters. Word import keeps supported headings, lists, tables and links. Complex layouts, embedded images and tracked changes are not preserved in the editable copy. Scanned PDFs need OCR before their text can be used. If extraction fails, the original file remains available from **Export → Original file**.

## Write and save

Use the formatting toolbar to write without Markdown syntax. Changes save after a short pause in typing, and the save indicator reports progress. You can also choose **Save** or press Ctrl+S / Command+S.

When two devices edit the same document, Workspace rejects a stale save and keeps your local draft. Choose **Save draft as a copy** to preserve it separately, then reload the saved version. A recovery copy is kept in the current browser while changes are unsaved; it is not a substitute for a successful server save.

## Work with the assistant

Configure a Codex or Claude account in **AI accounts** and choose its model under **Settings → Writing model**. Other provider integrations are retained from T3 Code but do not yet offer document drafting.

Open **Assistant**, select any additional source documents, and describe the result you want. Your current document is included automatically. Selected content is sent to the configured AI account. One draft can run at a time in a workspace.

A completed draft appears as a proposal beside your document. Compare the added and removed paragraphs, then apply or discard the proposal. Applying creates a new saved version. If the document changed while drafting, the old proposal cannot overwrite the newer version. Open a numbered source reference to read its original passage. Download buttons keep the complete source versions available. Check the underlying sources before relying on generated claims.

You can cancel a running draft. Accepted documents remain unchanged. Open **Activity** to check imports, drafts and exports, cancel running work, or retry a failed operation. After a server restart, unfinished operations show a retry message. If the document changed after a failed draft, start a new request using its current version.

## History and recovery

**History** lists saved versions. Restoring creates a new current version and keeps earlier versions available. It affects this document only.

Archived documents appear in **Archive**. Removed documents appear in **Trash**. Both collections offer a restore action. Workspace does not permanently erase document history in this release.

## Export and remote use

Save your changes before exporting. Choose Word, PDF, Markdown, text or the original file. Exports use a fixed saved version, so an edit made during export cannot change the download halfway through. PDF export supports basic text and tables; complex typography and full multilingual font coverage require further validation.

The selected computer owns the documents, AI account and processing. Files picked in a remote browser or on a phone upload to that computer. Downloads go to the device requesting them. Keep the host online; document authoring does not yet work offline.

The mobile companion supports reading, import, AI requests with selected sources, citation excerpts, proposal review, Activity, history and sharing exports. Full visual editing is available in the web and desktop apps.
