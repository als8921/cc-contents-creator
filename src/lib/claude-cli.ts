import { spawn } from "child_process";
import fs from "fs";
import path from "path";

/**
 * claude -p (plain text) 로 실행. 스트리밍 텍스트만 반환.
 */
export function streamClaude(prompt: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const proc = spawn("claude", ["-p"], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdin.write(prompt);
      proc.stdin.end();

      proc.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        console.error("[claude-cli]", chunk.toString());
      });

      proc.on("close", (code) => {
        try {
          if (code !== 0) controller.error(new Error(`claude exited with code ${code}`));
          else controller.close();
        } catch {}
      });

      proc.on("error", (err) => {
        try { controller.error(err); } catch {}
      });
    },
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * stream-json 이벤트를 디버그 로그로 변환.
 */
function summarizeEvent(evt: any): string | null {
  switch (evt.type) {
    case "system": {
      const tools = (evt.tools as string[] | undefined) ?? [];
      return `[system] ${evt.subtype ?? "init"} | model=${evt.model ?? "?"} | tools=${tools.length}개`;
    }

    case "assistant": {
      const content = evt.message?.content as any[] | undefined;
      if (!content) return null;

      const logs: string[] = [];
      for (const block of content) {
        if (block.type === "tool_use") {
          const input = JSON.stringify(block.input ?? {}).slice(0, 150);
          logs.push(`[tool_call] ${block.name}(${input})`);
        }
        if (block.type === "text" && block.text) {
          logs.push(`[text] ${(block.text as string).slice(0, 100)}...`);
        }
      }
      return logs.length > 0 ? logs.join("\n") : null;
    }

    case "tool_result": {
      const content = String(evt.content ?? "").slice(0, 300);
      return `[tool_result] ${content}`;
    }

    case "result": {
      const cost = typeof evt.total_cost_usd === "number" ? evt.total_cost_usd.toFixed(4) : "?";
      const turns = evt.num_turns ?? "?";
      const duration = typeof evt.duration_ms === "number" ? (evt.duration_ms / 1000).toFixed(1) : "?";
      return `[done] cost=$${cost}, turns=${turns}, ${duration}s`;
    }

    default:
      return null;
  }
}

/**
 * assistant 이벤트에서 텍스트를 추출.
 */
function extractTextFromAssistant(evt: any): string | null {
  if (evt.type !== "assistant") return null;
  const content = evt.message?.content as any[] | undefined;
  if (!content) return null;

  const texts: string[] = [];
  for (const block of content) {
    if (block.type === "text" && block.text) {
      texts.push(block.text);
    }
  }
  return texts.length > 0 ? texts.join("") : null;
}

/**
 * claude -p --output-format stream-json --verbose 실행.
 *
 * 서버→클라이언트 NDJSON 포맷:
 *   {"t":"x","d":"텍스트 내용"}   ← 본문 텍스트 (plan/make 출력)
 *   {"t":"d","d":"[tool_call] Read(...)"}  ← 디버그 로그
 */
export function streamClaudeWithLogs(prompt: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function emit(type: "x" | "d", data: string) {
        controller.enqueue(encoder.encode(JSON.stringify({ t: type, d: data }) + "\n"));
      }

      const proc = spawn("claude", ["-p", "--output-format", "stream-json", "--verbose"], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdin.write(prompt);
      proc.stdin.end();

      let buffer = "";
      let hasAssistantText = false;

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);

            // assistant 이벤트에서 텍스트 추출
            const text = extractTextFromAssistant(evt);
            if (text) {
              hasAssistantText = true;
              emit("x", text);
            }

            // result 이벤트 fallback (assistant text가 없었을 경우)
            if (evt.type === "result" && !hasAssistantText && typeof evt.result === "string") {
              emit("x", evt.result);
            }

            // 디버그 로그
            const log = summarizeEvent(evt);
            if (log) {
              // 멀티라인 로그 처리
              for (const logLine of log.split("\n")) {
                emit("d", logLine);
              }
            }
          } catch {
            emit("d", `[raw] ${line.slice(0, 300)}`);
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) emit("d", `[stderr] ${msg}`);
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          emit("d", `[error] claude exited with code ${code}`);
        }
        try { controller.close(); } catch {};
      });

      proc.on("error", (err) => {
        emit("d", `[error] ${err.message}`);
        try { controller.close(); } catch {};
      });
    },
  });
}

/**
 * output/{projectName}/html/ 디렉토리에서 HTML 파일들을 읽어 반환.
 */
export function readHtmlSlides(projectName: string): string[] {
  const htmlDir = path.join(process.cwd(), "output", projectName, "html");
  if (!fs.existsSync(htmlDir)) return [];

  return fs
    .readdirSync(htmlDir)
    .filter((f) => f.endsWith(".html"))
    .sort()
    .map((f) => fs.readFileSync(path.join(htmlDir, f), "utf-8"));
}
