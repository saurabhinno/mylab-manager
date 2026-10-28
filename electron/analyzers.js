/**
 * USB / serial analyzer discovery + LAN TCP listener for MyLab desktop.
 * Serial: one COM port at a time. LAN: TCP server for Net/Wireless (ASTM/HL7).
 */

const net = require("net");
const os = require("os");

const DEFAULT_BAUD = 9600;
/** Avoid 5000 — macOS Control Center often binds it. */
const DEFAULT_LAN_PORT = 5100;
const POLL_MS = 2500;
const ENQ = Buffer.from([0x05]);
const ACK = Buffer.from([0x06]);
const EOT = 0x04;
const VT = 0x0b;
const FS = 0x1c;

function loadSerialPort(log) {
  try {
    return require("serialport").SerialPort;
  } catch (err) {
    log("serialport module failed to load", err);
    return null;
  }
}

function listLocalIpv4() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces || {})) {
    for (const info of ifaces[name] || []) {
      if (info.family === "IPv4" && !info.internal) {
        out.push({ name, address: info.address });
      }
    }
  }
  // Prefer real LAN (DHCP) over APIPA 169.254.x / VPN noise so UI shows the
  // IP the analyzer should use first.
  out.sort((a, b) => {
    const score = (addr) => {
      if (addr.startsWith("169.254.")) return 2;
      if (addr.startsWith("10.") || addr.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[0-1])\./.test(addr))
        return 0;
      return 1;
    };
    return score(a.address) - score(b.address);
  });
  return out;
}

function createAnalyzerService({ log = console.log, getMainWindow } = {}) {
  const SerialPort = loadSerialPort(log);
  let pollTimer = null;
  let lastPortsJson = "[]";
  let openPort = null;
  let openPath = null;
  let rawBuffer = "";
  let lineCarry = "";
  let loadError = SerialPort
    ? null
    : "Serial driver not available. Rebuild desktop deps (serialport).";

  let lanServer = null;
  let lanPort = DEFAULT_LAN_PORT;
  let lanClients = 0;

  function send(channel, payload) {
    try {
      const win = typeof getMainWindow === "function" ? getMainWindow() : null;
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    } catch (err) {
      log("analyzer send failed", err);
    }
  }

  async function listPorts() {
    if (!SerialPort) return [];
    try {
      const ports = await SerialPort.list();
      return ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        vendorId: p.vendorId || null,
        productId: p.productId || null,
        serialNumber: p.serialNumber || null,
        pnpId: p.pnpId || null,
        friendlyName: buildFriendlyName(p),
        likelyAnalyzer: isLikelyAnalyzer(p),
      }));
    } catch (err) {
      log("SerialPort.list failed", err);
      loadError = err && err.message ? err.message : String(err);
      return [];
    }
  }

  function buildFriendlyName(p) {
    const bits = [];
    if (p.manufacturer) bits.push(p.manufacturer);
    if (p.path) bits.push(p.path);
    return bits.join(" · ") || p.path || "Unknown port";
  }

  function isLikelyAnalyzer(p) {
    const hay = `${p.manufacturer || ""} ${p.pnpId || ""} ${p.path || ""}`.toLowerCase();
    if (/bluetooth|debug|incoming/i.test(hay)) return false;
    if (/usb|serial|ftdi|ch340|cp210|prolific|wch/i.test(hay)) return true;
    if (p.vendorId) return true;
    if (/usbserial|usbmodem|ttyUSB|ttyACM|COM\d+/i.test(p.path || "")) return true;
    return false;
  }

  async function pollOnce() {
    const ports = await listPorts();
    const json = JSON.stringify(ports.map((p) => p.path).sort());
    if (json !== lastPortsJson) {
      lastPortsJson = json;
      send("analyzers:ports", ports);
    }
    return ports;
  }

  function startPolling() {
    if (pollTimer) return;
    pollOnce().catch(() => {});
    pollTimer = setInterval(() => {
      pollOnce().catch(() => {});
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function closeActive() {
    if (openPort) {
      const port = openPort;
      openPort = null;
      openPath = null;
      lineCarry = "";
      await new Promise((resolve) => {
        try {
          if (port.isOpen) port.close(() => resolve());
          else resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  function pushBytes(path, text) {
    rawBuffer += text;
    if (rawBuffer.length > 200_000) {
      rawBuffer = rawBuffer.slice(-100_000);
    }
    lineCarry += text;
    const parts = lineCarry.split(/\r\n|\n|\r/);
    lineCarry = parts.pop() || "";
    for (const line of parts) {
      if (!line.length) continue;
      send("analyzers:data", {
        path,
        chunk: line,
        at: new Date().toISOString(),
      });
      // USB serial (Clinitek): one CR-terminated record is a full result.
      if (/^COM\d+/i.test(String(path)) && line.includes(",")) {
        send("analyzers:message", {
          path,
          raw: line,
          at: new Date().toISOString(),
        });
      }
    }
    // Also notify that raw bytes arrived (for hex/live view)
    send("analyzers:raw", {
      path,
      chunk: text,
      at: new Date().toISOString(),
    });
  }

  async function openAndListen(path, options = {}) {
    if (!SerialPort) {
      throw new Error(loadError || "Serial driver not available");
    }
    if (!path) throw new Error("Port path required");
    const baudRate = Number(options.baudRate) || DEFAULT_BAUD;
    const dataBits = Number(options.dataBits) || 8;
    const stopBits = Number(options.stopBits) || 1;
    const parity = options.parity || "none";

    await closeActive();
    rawBuffer = "";
    lineCarry = "";

    return new Promise((resolve, reject) => {
      const port = new SerialPort({
        path,
        baudRate,
        dataBits,
        stopBits,
        parity,
        autoOpen: false,
      });

      port.open((err) => {
        if (err) {
          reject(err);
          return;
        }
        openPort = port;
        openPath = path;

        port.on("data", (buf) => {
          pushBytes(path, buf.toString("utf8"));
        });

        port.on("error", (e) => {
          send("analyzers:error", { path, error: e.message });
        });

        port.on("close", () => {
          if (openPath === path) {
            openPort = null;
            openPath = null;
          }
          send("analyzers:closed", { path });
        });

        send("analyzers:opened", { path, baudRate });
        resolve({ ok: true, path, baudRate });
      });
    });
  }

  function emitMessageComplete(source, text) {
    const cleaned = String(text || "");
    if (!cleaned.trim()) return;
    pushBytes(source, cleaned.endsWith("\r") ? cleaned : cleaned + "\r");
    send("analyzers:message", {
      path: source,
      raw: cleaned,
      at: new Date().toISOString(),
    });
  }

  function handleLanSocket(socket) {
    const remote = `${socket.remoteAddress || "?"}:${socket.remotePort || "?"}`;
    const source = `lan://${remote}`;
    lanClients += 1;
    send("analyzers:lanClient", {
      event: "connect",
      remote,
      clients: lanClients,
    });

    let buf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      // ASTM session: reply ACK to ENQ so the analyzer continues.
      if (chunk.includes(0x05)) {
        try {
          socket.write(ACK);
        } catch {
          /* ignore */
        }
      }

      buf = Buffer.concat([buf, chunk]);
      // drop ENQ from buffer
      if (buf.includes(0x05)) {
        buf = Buffer.from([...buf].filter((b) => b !== 0x05));
      }

      // MLLP (HL7): VT ... FS CR
      let handledMllp = false;
      while (true) {
        const start = buf.indexOf(VT);
        const end = buf.indexOf(FS);
        if (start >= 0 && end > start) {
          const frame = buf.slice(start + 1, end).toString("utf8");
          buf = buf.slice(end + 1);
          if (buf[0] === 0x0d) buf = buf.slice(1);
          emitMessageComplete(source, frame);
          handledMllp = true;
          continue;
        }
        break;
      }
      if (handledMllp && buf.length === 0) return;

      const ascii = buf.toString("utf8");
      // ASTM: complete on EOT or L| terminator record
      if (buf.includes(EOT) || /(?:^|\r|\n)\d*L\|/m.test(ascii)) {
        const text = ascii.replace(/\x04/g, "");
        buf = Buffer.alloc(0);
        emitMessageComplete(source, text);
      } else if (buf.length > 100_000) {
        const text = ascii;
        buf = Buffer.alloc(0);
        emitMessageComplete(source, text);
      } else {
        // live preview of partial data
        const preview = chunk.toString("utf8").replace(/\x05/g, "");
        if (preview.trim()) {
          send("analyzers:raw", {
            path: source,
            chunk: preview,
            at: new Date().toISOString(),
          });
        }
      }
    });

    socket.on("close", () => {
      lanClients = Math.max(0, lanClients - 1);
      if (buf.length) {
        emitMessageComplete(source, buf.toString("utf8").replace(/\x04/g, ""));
        buf = Buffer.alloc(0);
      }
      send("analyzers:lanClient", {
        event: "close",
        remote,
        clients: lanClients,
      });
    });

    socket.on("error", (err) => {
      send("analyzers:error", {
        path: source,
        error: err.message || String(err),
      });
    });
  }

  function startLan(port = DEFAULT_LAN_PORT) {
    const p = Number(port) || DEFAULT_LAN_PORT;
    if (lanServer) {
      return Promise.resolve({
        ok: true,
        already: true,
        port: lanPort,
        addresses: listLocalIpv4(),
      });
    }

    return new Promise((resolve) => {
      const server = net.createServer((socket) => handleLanSocket(socket));
      server.on("error", (err) => {
        lanServer = null;
        send("analyzers:error", {
          path: "lan",
          error: err.message || String(err),
        });
        resolve({ ok: false, error: err.message || String(err) });
      });
      server.listen(p, "0.0.0.0", () => {
        lanServer = server;
        lanPort = p;
        const addresses = listLocalIpv4();
        send("analyzers:lan", {
          listening: true,
          port: p,
          addresses,
        });
        resolve({ ok: true, port: p, addresses });
      });
    });
  }

  function stopLan() {
    return new Promise((resolve) => {
      if (!lanServer) {
        resolve({ ok: true, listening: false });
        return;
      }
      const server = lanServer;
      lanServer = null;
      try {
        server.close(() => {
          send("analyzers:lan", {
            listening: false,
            port: lanPort,
            addresses: listLocalIpv4(),
          });
          resolve({ ok: true, listening: false });
        });
      } catch (err) {
        resolve({
          ok: false,
          error: err && err.message ? err.message : String(err),
        });
      }
    });
  }

  function tcpProbe(host, port, timeoutMs = 800) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;
      const finish = (ok, err) => {
        if (done) return;
        done = true;
        try {
          socket.destroy();
        } catch {
          /* ignore */
        }
        resolve({ port, ok, error: err || null });
      };
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => finish(true));
      socket.once("timeout", () => finish(false, "timeout"));
      socket.once("error", (e) => finish(false, e.message || String(e)));
      try {
        socket.connect(port, host);
      } catch (e) {
        finish(false, e.message || String(e));
      }
    });
  }

  /**
   * Diagnose path to analyzer. Cellenium Net mode is push-to-LIS (we listen);
   * outbound connect only helps if the machine is acting as a TCP server.
   */
  async function probeHost(host, ports) {
    const h = String(host || "").trim();
    if (!h) return { ok: false, error: "Machine IP required" };
    const list = Array.isArray(ports) && ports.length
      ? ports.map(Number)
      : [5100, 2575, 5000, 22, 23, 80];
    const results = [];
    for (const p of list) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await tcpProbe(h, p));
    }
    const open = results.filter((r) => r.ok).map((r) => r.port);
    const pcLan =
      listLocalIpv4().find((a) => a.address.startsWith("192.168.10."))?.address ||
      listLocalIpv4().find((a) => !a.address.startsWith("169.254."))?.address ||
      "PC-IP";
    const hint = !lanServer
      ? "Start LAN listen first — Cellenium pushes HL7 to this PC."
      : open.includes(Number(lanPort)) || open.includes(5100)
        ? "Machine is listening on HL7 port — use Connect to pull."
        : open.length
          ? `Cable OK (open: ${open.join(",")}). Machine does not serve HL7. On Transmit it must dial ${pcLan}:${lanPort}. If MyLab stays at clients=0, the analyzer is not opening that TCP session (check SETUP Server IP=${pcLan}, Status not Unconnected, Save + reboot). McAfee firewall can also block inbound :${lanPort}.`
          : "Cannot reach machine TCP ports. Check Ethernet cable and Local IP.";
    return {
      ok: true,
      host: h,
      openPorts: open,
      results,
      ourListen: { port: lanPort, listening: !!lanServer, selfConnectOk: !!lanServer },
      addresses: listLocalIpv4(),
      hint,
    };
  }

  let lanClientSocket = null;

  function disconnectLanClient() {
    if (lanClientSocket) {
      try {
        lanClientSocket.destroy();
      } catch {
        /* ignore */
      }
      lanClientSocket = null;
    }
  }

  /** Outbound TCP to analyzer (only if machine listens). Same HL7/ASTM framing. */
  function connectLan(host, port = DEFAULT_LAN_PORT) {
    const h = String(host || "").trim();
    const p = Number(port) || DEFAULT_LAN_PORT;
    if (!h) return Promise.resolve({ ok: false, error: "Machine IP required" });
    disconnectLanClient();
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const socket = net.connect({ host: h, port: p }, () => {
        socket.setTimeout(0);
        lanClientSocket = socket;
        handleLanSocket(socket);
        finish({ ok: true, host: h, port: p });
      });
      socket.setTimeout(5000);
      socket.once("timeout", () => {
        socket.destroy();
        finish({
          ok: false,
          error: `Timeout connecting to ${h}:${p} — machine is not accepting (Cellenium Net mode expects machine → PC, not PC → machine).`,
        });
      });
      socket.once("error", (err) => {
        finish({
          ok: false,
          error: err.message || String(err),
        });
      });
    });
  }

  function getStatus() {
    return {
      openPath,
      listening: !!openPort && openPort.isOpen,
      defaultBaud: DEFAULT_BAUD,
      rawPreview: rawBuffer.slice(-8000),
      available: !!SerialPort,
      error: loadError,
      lan: {
        listening: !!lanServer,
        port: lanPort,
        defaultPort: DEFAULT_LAN_PORT,
        clients: lanClients,
        addresses: listLocalIpv4(),
      },
    };
  }

  function getRawBuffer() {
    return rawBuffer;
  }

  function clearRawBuffer() {
    rawBuffer = "";
    lineCarry = "";
  }

  /** Open the first FTDI USB serial port (Clinitek Status+ cable) at 57600 8N1. */
  async function startUsb() {
    if (!SerialPort) return { ok: false, error: loadError || "No serial driver" };
    if (openPort && openPort.isOpen) {
      return { ok: true, path: openPath, already: true };
    }
    const ports = await listPorts();
    const ftdi = ports.find((p) => {
      const id = `${p.vendorId || ""} ${p.manufacturer || ""} ${p.pnpId || ""}`;
      return /0403|ftdi/i.test(id);
    });
    if (!ftdi) {
      log("Clinitek USB serial port not found");
      return { ok: false, error: "No FTDI serial port" };
    }
    try {
      const opened = await openAndListen(ftdi.path, {
        baudRate: 57600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });
      log(`Clinitek USB listening on ${ftdi.path} @ 57600`);
      return opened;
    } catch (err) {
      log("Clinitek USB open failed", err);
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  return {
    listPorts,
    startPolling,
    stopPolling,
    openAndListen,
    closeActive,
    startLan,
    startUsb,
    stopLan,
    probeHost,
    connectLan,
    disconnectLanClient,
    getStatus,
    getRawBuffer,
    clearRawBuffer,
  };
}

module.exports = { createAnalyzerService, DEFAULT_BAUD, DEFAULT_LAN_PORT };
