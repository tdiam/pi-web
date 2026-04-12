import { describe, expect, it } from "vitest";
import { contentBlocks, normalizeTranscript, type TranscriptEntryLike } from "../transcript";

describe("normalizeTranscript", () => {
	it("merges a standalone tool result into the preceding assistant tool call", () => {
		const messages: TranscriptEntryLike[] = [
			{
				id: "a1",
				role: "assistant",
				content: [
					{ type: "text", text: "Checking the workspace." },
					{ type: "toolCall", name: "bash", arguments: '{"command":"pwd"}' },
				],
			},
			{
				id: "t1",
				role: "tool",
				content: "stdout: /repo",
			},
		];

		const normalized = normalizeTranscript(messages);
		expect(normalized).toHaveLength(1);
		expect(normalized[0].role).toBe("assistant");

		const blocks = contentBlocks(normalized[0]);
		expect(blocks).toHaveLength(2);
		expect(blocks[1]).toMatchObject({
			kind: "tool",
			toolName: "bash",
			argumentsText: '{"command":"pwd"}',
			resultText: "stdout: /repo",
		});
	});

	it("pairs tool results with tool calls in execution order", () => {
		const messages: TranscriptEntryLike[] = [
			{
				id: "a1",
				role: "assistant",
				content: [
					{ type: "toolCall", name: "read", arguments: '{"path":"a.txt"}' },
					{ type: "toolCall", name: "read", arguments: '{"path":"b.txt"}' },
				],
			},
			{ id: "t1", role: "tool", content: "A" },
			{ id: "t2", role: "tool", content: "B" },
		];

		const normalized = normalizeTranscript(messages);
		const blocks = contentBlocks(normalized[0]);
		expect(blocks).toHaveLength(2);
		expect(blocks[0]).toMatchObject({ kind: "tool", toolName: "read", resultText: "A" });
		expect(blocks[1]).toMatchObject({ kind: "tool", toolName: "read", resultText: "B" });
	});

	it("leaves unmatched tool results as standalone messages", () => {
		const messages: TranscriptEntryLike[] = [
			{ id: "u1", role: "user", content: "hello" },
			{ id: "t1", role: "tool", content: "orphan result" },
		];

		const normalized = normalizeTranscript(messages);
		expect(normalized).toHaveLength(2);
		expect(normalized[1]).toMatchObject({ id: "t1", role: "tool", content: "orphan result" });
	});

	it("does not mutate the original transcript array", () => {
		const assistant = {
			id: "a1",
			role: "assistant",
			content: [{ type: "toolCall", name: "bash", arguments: '{"command":"ls"}' }],
		} satisfies TranscriptEntryLike;
		const tool = { id: "t1", role: "tool", content: "file.txt" } satisfies TranscriptEntryLike;

		const normalized = normalizeTranscript([assistant, tool]);
		expect(normalized[0]).not.toBe(assistant);
		expect(normalized[0].content).not.toBe(assistant.content);
		expect(assistant.content).toEqual([{ type: "toolCall", name: "bash", arguments: '{"command":"ls"}' }]);
	});
});
