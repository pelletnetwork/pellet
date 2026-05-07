commit 43ca231d8220eecf600a83ffde798c6c7466233c
Author: myelectricfiles <268790358+myelectricfiles@users.noreply.github.com>
Date:   Wed May 6 22:03:06 2026 -0500

    fix: reset terminal pty after 5s disconnect (sign-out resets banner)
    
    Tab switching reconnects instantly so pty is preserved. Sign-out
    leaves the bridge disconnected long enough for the cleanup timer
    to kill the pty, so sign-in gets a fresh banner.
    
    Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

diff --git a/scripts/terminal-bridge.js b/scripts/terminal-bridge.js
index 8e45931..732758d 100755
--- a/scripts/terminal-bridge.js
+++ b/scripts/terminal-bridge.js
@@ -13,6 +13,7 @@ let scrollback = "";
 let interacted = false;
 let client = null;
 let sessionAddr = null;
+let cleanupTimer = null;
 
 function spawnPty() {
   const onboarded = require("fs").existsSync(
@@ -60,6 +61,11 @@ const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
 console.log(`pellet terminal bridge listening on ws://localhost:${PORT}`);
 
 wss.on("connection", (ws) => {
+  if (cleanupTimer) {
+    clearTimeout(cleanupTimer);
+    cleanupTimer = null;
+  }
+
   if (client) {
     client.removeAllListeners?.();
     client.close(4001, "replaced by new connection");
@@ -106,6 +112,17 @@ wss.on("connection", (ws) => {
   setTimeout(() => sendInit(), 200);
 
   ws.on("close", () => {
-    if (client === ws) client = null;
+    if (client === ws) {
+      client = null;
+      cleanupTimer = setTimeout(() => {
+        if (!client && term) {
+          term.kill();
+          term = null;
+          scrollback = "";
+          interacted = false;
+          sessionAddr = null;
+        }
+      }, 5000);
+    }
   });
 });
