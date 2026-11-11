/**
 * Reads a newline-delimited JSON stream (one JSON object per line) and calls `onObject` for each line as it
 * arrives. A line can be split across network chunks, so text is buffered until its newline shows up.
 * Blank lines and lines that are not valid JSON are skipped rather than ending the stream.
 */
export async function readNdjson(
  stream: ReadableStream<Uint8Array>,
  onObject: (value: unknown) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emit = (line: string) => {
    const text = line.trim();
    if (!text) return;
    try {
      onObject(JSON.parse(text));
    } catch {
      // Not JSON: ignore this line and keep reading.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // the last piece has no newline yet
      lines.forEach(emit);
    }
    emit(buffer + decoder.decode()); // a final line without a trailing newline
  } finally {
    reader.releaseLock();
  }
}
