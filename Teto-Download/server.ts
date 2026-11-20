import { join } from "node:path";

async function fileExists(path: string): Promise<boolean> {
  try {
    const stat = await Deno.stat(path);
    return stat.isFile;
  } catch {
    return false;
  }
}

async function isCommandInPath(cmd: string): Promise<boolean> {
  try {
    const checker = Deno.build.os === "windows" ? "where" : "which";
    const proc = new Deno.Command(checker, {
      args: [cmd],
      stdout: "null",
      stderr: "null",
    });
    const status = await proc.output();
    return status.success;
  } catch {
    return false;
  }
}

async function resolveYtDlp(): Promise<{ found: boolean; path: string; source: "local" | "path" | "missing" }> {
  const localExe = Deno.build.os === "windows"
    ? "./assets/backend/yt-dlp.exe"
    : "./assets/backend/yt-dlp";

  if (await fileExists(localExe)) {
    return { found: true, path: localExe, source: "local" };
  }
  if (await isCommandInPath("yt-dlp")) {
    return { found: true, path: "yt-dlp", source: "path" };
  }
  return { found: false, path: localExe, source: "missing" };
}

async function checkEnvironment() {
  const ytDlp = await resolveYtDlp();
  const denoVersion = Deno.version.deno;
  return {
    deno: { found: Boolean(denoVersion), version: denoVersion },
    ytDlp,
  };
}

const startupEnv = await checkEnvironment();
if (!startupEnv.ytDlp.found) {
  console.warn("[WARNING] yt-dlp tidak ditemukan di .\\assets\\backend\\ maupun di PATH sistem!");
} else {
  console.log(`[OK] yt-dlp terdeteksi (${startupEnv.ytDlp.source}): ${startupEnv.ytDlp.path}`);
}
console.log(`[OK] Deno runtime aktif: v${startupEnv.deno.version}`);

Deno.serve({ port: 8000 }, async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/api/check-env") {
    const envStatus = await checkEnvironment();
    return new Response(JSON.stringify(envStatus), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (req.method === "GET" && url.pathname === "/") {
    try {
      const html = await Deno.readTextFile("./index.html");
      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (_e) {
      return new Response("Could not find index.html.", { status: 404 });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/teto-sound/")) {
    try {
      const filename = decodeURIComponent(url.pathname.replace("/teto-sound/", ""));
      const filePath = join("./assets/sfx/teto sound", filename);
      const fileData = await Deno.readFile(filePath);
      return new Response(fileData, {
        headers: { "content-type": "audio/mpeg" },
      });
    } catch (_e) {
      return new Response("Audio file not found.", { status: 404 });
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/rei-sound/")) {
    try {
      const filename = decodeURIComponent(url.pathname.replace("/rei-sound/", ""));
      const filePath = join("./assets/sfx/rei sound", filename);
      const fileData = await Deno.readFile(filePath);
      return new Response(fileData, {
        headers: { "content-type": "audio/mpeg" },
      });
    } catch (_e) {
      return new Response("Audio file not found.", { status: 404 });
    }
  }

  if (
    req.method === "GET" &&
    (url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".wav") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".mp3") ||
      url.pathname.endsWith(".ico"))
  ) {
    try {
      const cleanPath = decodeURIComponent(url.pathname);
      const filePath = cleanPath.startsWith("/assets/") ? "." + cleanPath : join("./assets/photo", cleanPath);
      const fileData = await Deno.readFile(filePath);
      const contentType = filePath.endsWith(".png")
        ? "image/png"
        : filePath.endsWith(".jpg")
          ? "image/jpeg"
          : filePath.endsWith(".ico")
            ? "image/x-icon"
            : filePath.endsWith(".mp3")
              ? "audio/mpeg"
              : "audio/wav";
      return new Response(fileData, {
        headers: { "content-type": contentType },
      });
    } catch (_e) {
      return new Response("File not found.", { status: 404 });
    }
  }

  if (req.method === "POST" && url.pathname === "/download") {
    try {
      const ytDlpInfo = await resolveYtDlp();
      if (!ytDlpInfo.found) {
        return new Response(
          "[Error] yt-dlp tidak ditemukan! Taruh yt-dlp.exe di .\\assets\\backend\\ atau tambahkan ke PATH.\n",
          { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } }
        );
      }

      const data = await req.json();
      console.log("Received download request for:", data.url);

      const args: string[] = [];

      if (data.outputPath && data.outputPath.trim() !== "") {
        args.push("-P", data.outputPath.trim());
      }

      args.push("-o", "%(title)s.%(ext)s");
      args.push(data.chkPlaylist ? "--yes-playlist" : "--no-playlist");

      if (data.chkMetadata) {
        args.push("--embed-metadata");
        args.push("--extractor-args", "youtube:lang=en");
      }

      if (data.chkCover && data.formatSelect !== "wav") {
        args.push("--embed-thumbnail");
      }

      if (data.chkVideo && data.chkAudio) {
        args.push("-f", `bv*[height<=${data.videoRes}]+ba/b`);
        args.push("--merge-output-format", data.formatSelect);
      } else if (data.chkVideo && !data.chkAudio) {
        args.push("-f", `bv*[height<=${data.videoRes}]`);
        args.push("--remux-video", data.formatSelect);
      } else if (!data.chkVideo && data.chkAudio) {
        args.push("-x");
        args.push("--audio-format", data.formatSelect);
        args.push("--audio-quality", data.audioQual ? data.audioQual.toString() : "0");
      }

      let tempBatchFile: string | null = null;
      const rawUrlInput: string = data.url ? data.url.trim() : "";

      if (data.chkBatch || rawUrlInput.includes("\n") || rawUrlInput.includes("\r")) {
        tempBatchFile = await Deno.makeTempFile({ suffix: ".txt" });
        await Deno.writeTextFile(tempBatchFile, rawUrlInput);
        args.push("-a", tempBatchFile);
      } else {
        args.push(rawUrlInput);
      }

      console.log("Executing yt-dlp with arguments:", args.join(" "));

      const command = new Deno.Command(ytDlpInfo.path, {
        args: args,
        stdout: "piped",
        stderr: "piped",
      });

      const child = command.spawn();

      const body = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const stdoutReader = child.stdout.getReader();
          const stderrReader = child.stderr.getReader();

          try {
            (async () => {
              while (true) {
                const { value, done } = await stdoutReader.read();
                if (done) break;
                controller.enqueue(value);
              }
            })();

            (async () => {
              while (true) {
                const { value, done } = await stderrReader.read();
                if (done) break;
                controller.enqueue(value);
              }
            })();

            const status = await child.status;
            if (status.success) {
              controller.enqueue(encoder.encode("\n[System] Download Complete!\n"));
            } else {
              controller.enqueue(encoder.encode(`\n[System] Process exited with code ${status.code}\n`));
            }
          } catch (err) {
            controller.enqueue(encoder.encode(`\n[Error] ${(err as Error).message}\n`));
          } finally {
            if (tempBatchFile) {
              try { await Deno.remove(tempBatchFile); } catch (_) { /* ignore */ }
            }
            controller.close();
          }
        },
      });

      return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    } catch (_error) {
      return new Response("Server error occurred.", { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
});