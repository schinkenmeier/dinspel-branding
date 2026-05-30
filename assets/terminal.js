(function () {
  const terminal = document.getElementById("terminal");
  const termRoot = document.querySelector(".term");
  const gitHubLink = document.querySelector(".cD-gh");
  const prompt = "~ $";
  const baseTime = Date.UTC(2025, 1, 11, 3, 0, 0);
  const commandHistory = [];
  const timers = [];
  let blocks = [];
  let input = "";
  let booted = false;
  let focused = false;
  let historyIndex = -1;
  let inputEl;

  const row = (...spans) => spans.map((span) => typeof span === "string" ? { t: span } : span);
  const ac = (t) => ({ t, c: "ac" });
  const dm = (t) => ({ t, c: "dm" });
  const ok = (t) => ({ t, c: "ok" });
  const er = (t) => ({ t, c: "er" });
  const hd = (t) => ({ t, c: "hd" });

  const fortunes = [
    "if it works, document it before touching it again.",
    "nothing is permanent except temporary shell scripts.",
    "the backup you tested is the backup you have.",
    "a quiet dashboard is either healthy or lying.",
    "future you has requested fewer clever ideas.",
  ];

  const commands = {
    help: () => [
      row(dm("available commands")),
      row(""),
      row(ac("  about"), dm("       what this place is")),
      row(ac("  whoami"), dm("      your session")),
      row(ac("  status"), dm("      system health")),
      row(ac("  projects"), dm("    what runs here")),
      row(ac("  contact"), dm("     reach the operator")),
      row(ac("  uptime"), dm("      how long it's been up")),
      row(ac("  clear"), dm("       wipe the screen")),
    ],
    about: () => [
      row({ t: "dinspel.eu", c: "hd" }),
      row(dm("self-hosted infrastructure & automation.")),
      row(""),
      row("a private slice of the internet — built, broken,"),
      row("and rebuilt by one person. no tenants, no vendors,"),
      row("no dashboards for rent. just systems that do their"),
      row("job quietly and stay out of the way."),
    ],
    whoami: () => [
      row({ t: "guest", c: "hd" }, dm(" · read-only session")),
      row(""),
      row("authenticated by curiosity. you're welcome to look"),
      row("around — the interesting parts stay behind the wall."),
    ],
    status: () => [
      row(ok("● "), "all systems nominal"),
      row(""),
      row(dm("  context   "), "secure"),
      row(dm("  region    "), "private"),
      row(dm("  mode      "), "read-only"),
      row(dm("  load      "), "steady"),
      row(""),
      row(dm("last checked just now.")),
    ],
    "status --verbose": () => [
      row(ok("● "), "all systems nominal"),
      row(""),
      row(dm("  public details    "), "minimal"),
      row(dm("  private details   "), "still private"),
      row(dm("  trust boundary    "), "working as intended"),
      row(dm("  incident count    "), "none worth admitting"),
      row(dm("  operator vibe     "), "nominal"),
      row(""),
      row(dm("verbose mode redacted itself out of courtesy.")),
    ],
    projects: () => [
      row(dm("what runs here")),
      row(""),
      row(ac("  → automation   "), "quiet jobs that run so i don't have to"),
      row(ac("  → archival     "), "things kept safe, versioned, and dull"),
      row(ac("  → networking   "), "the plumbing. you'll never see it."),
      row(ac("  → tinkering    "), "the part that occasionally catches fire"),
      row(""),
      row(dm("details intentionally omitted.")),
    ],
    contact: () => [
      row(dm("reach the operator")),
      row(""),
      row(dm("  mail   "), ac("hello@dinspel.eu")),
      row(dm("  pgp    "), "on request"),
      row(""),
      row(dm("no forms. no funnels. just send a message.")),
    ],
    uptime: () => {
      const ms = Date.now() - baseTime;
      const days = Math.floor(ms / 86400000);
      const hours = Math.floor((ms % 86400000) / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);

      return [
        row("uptime ", { t: `${days} days, ${hours} hours, ${minutes} minutes`, c: "hd" }),
        row(""),
        row(dm("running since the last time i swore i'd")),
        row(dm("\"just quickly reboot it.\"")),
      ];
    },
    coffee: () => [
      row(dm("operator fuel level")),
      row(""),
      row(ok("acceptable")),
      row(dm("brew queue: pending")),
    ],
    fortune: () => {
      const index = Math.floor(Math.random() * fortunes.length);
      return [
        row(dm("fortune")),
        row(""),
        row(hd(fortunes[index])),
      ];
    },
    sudo: () => [
      row(er("permission denied")),
      row(""),
      row(dm("nice try. this incident has been logged nowhere.")),
    ],
    "rm -rf /": () => [
      row(er("permission denied")),
      row(""),
      row(dm("also: please don't.")),
    ],
    "open the pod bay doors": () => [
      row(dm("request received")),
      row(""),
      row("i'm afraid i can't do that, guest."),
    ],
  };

  const aliases = { "?": "help", man: "help", ls: "projects", info: "about", who: "whoami" };
  const commandNames = ["help", "about", "whoami", "status", "projects", "contact", "uptime", "clear"];
  const hiddenCommandNames = ["coffee", "fortune", "sudo"];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderSpan(span) {
    const node = el("span", span.c ? `sp-${span.c}` : undefined, span.t);
    return node;
  }

  function renderRow(spans) {
    const node = el("div", "t-row");
    if (!spans.length || (spans.length === 1 && spans[0].t === "")) {
      node.innerHTML = "&nbsp;";
      return node;
    }

    spans.forEach((span) => node.appendChild(renderSpan(span)));
    return node;
  }

  function renderBoot(block) {
    const node = el("div", "t-row t-boot");
    if (!block.text) {
      node.innerHTML = "<span>&nbsp;</span>";
      return node;
    }

    node.appendChild(el("span", "boot-mark", block.ok ? "›" : ""));
    node.appendChild(el("span", block.ok ? "sp-dm" : "sp-hd", block.text));
    return node;
  }

  function renderCommand(block) {
    const node = el("div", "t-row t-cmdline");
    node.appendChild(el("span", "sp-prompt", block.prompt));
    node.appendChild(el("span", "t-cmdtext", block.text));
    return node;
  }

  function renderOutput(block) {
    const node = el("div", "t-block");
    block.rows.forEach((spans) => node.appendChild(renderRow(spans)));
    return node;
  }

  function renderInput() {
    const node = el("div", "t-row t-inputline");
    node.appendChild(el("span", "sp-prompt", prompt));
    node.appendChild(el("span", "t-typed", input));
    node.appendChild(el("span", `t-cursor ${focused ? "blink" : "solid"}`));

    inputEl = el("input", "t-hidden-input");
    inputEl.type = "text";
    inputEl.value = input;
    inputEl.setAttribute("aria-label", "Terminal command input");
    inputEl.setAttribute("spellcheck", "false");
    inputEl.setAttribute("autocomplete", "off");
    inputEl.setAttribute("autocapitalize", "off");
    inputEl.addEventListener("input", (event) => {
      input = event.target.value;
      render();
      focusInput();
    });
    inputEl.addEventListener("keydown", onKeyDown);
    inputEl.addEventListener("focus", () => {
      focused = true;
      updateFocusState();
    });
    inputEl.addEventListener("blur", () => {
      focused = false;
      updateFocusState();
    });
    node.appendChild(inputEl);
    return node;
  }

  function render() {
    terminal.textContent = "";

    blocks.forEach((block) => {
      if (block.kind === "boot") terminal.appendChild(renderBoot(block));
      if (block.kind === "cmd") terminal.appendChild(renderCommand(block));
      if (block.kind === "out" || block.kind === "err") terminal.appendChild(renderOutput(block));
    });

    if (booted) terminal.appendChild(renderInput());
    terminal.scrollTop = terminal.scrollHeight;
  }

  function focusInput() {
    if (!inputEl || document.activeElement === inputEl) return;
    inputEl.focus({ preventScroll: true });
  }

  function updateFocusState() {
    const cursor = terminal.querySelector(".t-cursor");
    if (!cursor) return;
    cursor.className = `t-cursor ${focused ? "blink" : "solid"}`;
  }

  function pushBlock(block) {
    blocks = [...blocks, block];
    render();
  }

  function run(raw) {
    const command = raw.trim();
    pushBlock({ kind: "cmd", text: raw, prompt });

    if (command) commandHistory.push(command);
    historyIndex = -1;
    if (!command) return;

    const name = resolveCommand(command);
    if (name === "clear") {
      blocks = [];
      render();
      return;
    }

    if (commands[name]) {
      pushBlock({ kind: "out", rows: commands[name]() });
      return;
    }

    pushBlock({
      kind: "err",
      rows: [
        row({ t: "command not found: ", c: "er" }, { t: command, c: "er" }),
        row(dm("type "), ac("help"), dm(" for the list.")),
      ],
    });
  }

  function resolveCommand(command) {
    const normalized = command.toLowerCase().replace(/\s+/g, " ").trim();
    if (aliases[normalized]) return aliases[normalized];
    if (normalized.startsWith("sudo ")) return "sudo";
    if (normalized === "sudo") return "sudo";
    if (normalized === "rm -rf /" || normalized === "rm -rf /*") return "rm -rf /";
    if (normalized === "open the pod bay doors") return "open the pod bay doors";
    return normalized;
  }

  function onKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      run(input);
      input = "";
      render();
      focusInput();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!commandHistory.length) return;
      historyIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
      input = commandHistory[historyIndex];
      render();
      focusInput();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        historyIndex = -1;
        input = "";
      } else {
        historyIndex = nextIndex;
        input = commandHistory[historyIndex];
      }
      render();
      focusInput();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const fragment = input.trim().toLowerCase();
      if (!fragment) return;
      const match = [...commandNames, ...hiddenCommandNames].find((name) => name.startsWith(fragment));
      if (match) {
        input = match;
        render();
        focusInput();
      }
      return;
    }

    if (event.key.toLowerCase() === "l" && event.ctrlKey) {
      event.preventDefault();
      blocks = [];
      render();
      focusInput();
    }
  }

  function boot() {
    const sequence = [
      { text: "initializing interface...", at: 600, ok: true },
      { text: "establishing secure context...", at: 1060, ok: true },
      { text: "loading modules...", at: 1520, ok: true },
      { text: "", at: 1780, ok: false },
      { text: "welcome.", at: 1980, ok: false },
    ];

    sequence.forEach((line) => {
      timers.push(window.setTimeout(() => pushBlock({ kind: "boot", text: line.text, ok: line.ok }), line.at));
    });
    timers.push(window.setTimeout(() => {
      booted = true;
      render();
      focusInput();
    }, 2360));
  }

  termRoot.addEventListener("mousedown", () => window.requestAnimationFrame(focusInput));
  gitHubLink.addEventListener("click", (event) => event.preventDefault());
  window.addEventListener("beforeunload", () => timers.forEach(window.clearTimeout));

  render();
  boot();
})();
