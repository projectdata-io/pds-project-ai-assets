<script lang="ts">
  import { Check, ChevronRight, Copy, Download, ExternalLink, Search, ShieldCheck, X } from "lucide-svelte";
  import MarkdownIt from "markdown-it";
  import { resolve } from "$app/paths";
  import { env } from "$env/dynamic/public";
  import catalogSource from "$lib/generated/catalog.json";

  type Skill = { name: string; category: string; access: string; content: string };
  type Agent = {
    name: string;
    title: string;
    description: string;
    access: "read-only" | "commit";
    authoringTargets: string[];
    packageFile: string;
    instructions: string;
    setupGuide: string;
    agentTemplate: string | null;
    skills: Skill[];
  };

  const catalog = catalogSource as { product: string; catalogVersion: string; mcpContractVersion: string; agents: Agent[] };
  const repository = env.PUBLIC_GITHUB_REPOSITORY || "pds-project-ai/pds-project-ai-assets";
  const repositoryUrl = `https://github.com/${repository}`;
  const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });

  markdown.validateLink = (url) => {
    const value = url.trim();
    if (value.startsWith("//")) return false;
    const scheme = value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    return !scheme || scheme === "http" || scheme === "https" || scheme === "mailto";
  };
  markdown.disable("image");

  let query = $state("");
  let access = $state<"all" | Agent["access"]>("all");
  let selected = $state<Agent | null>(null);
  let activeTab = $state<"setup" | "instructions" | "template" | "skills">("setup");
  let selectedSkill = $state<Skill | null>(null);
  let copied = $state("");

  const filteredAgents = $derived(
    catalog.agents.filter((agent) => {
      const searchable = `${agent.title} ${agent.description} ${agent.skills.map((skill) => skill.name).join(" ")}`.toLowerCase();
      return (access === "all" || agent.access === access) && searchable.includes(query.trim().toLowerCase());
    })
  );

  function downloadUrl(agent: Agent) {
    return `${repositoryUrl}/releases/latest/download/${agent.packageFile}`;
  }

  function openAgent(agent: Agent) {
    selected = agent;
    selectedSkill = agent.skills[0] ?? null;
    activeTab = "setup";
  }

  function openSkill(skill: Skill) {
    selectedSkill = skill;
    activeTab = "skills";
  }

  function tabContent(agent: Agent) {
    if (activeTab === "instructions") return agent.instructions;
    if (activeTab === "template") return agent.agentTemplate ?? "";
    return agent.setupGuide;
  }

  function renderMarkdown(value: string) {
    const frontmatter = value.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!frontmatter) return markdown.render(value);
    const body = value.slice(frontmatter[0].length);
    return markdown.render(`\`\`\`yaml\n${frontmatter[1]}\n\`\`\`\n\n${body}`);
  }

  async function copyText(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      copied = label;
      window.setTimeout(() => {
        if (copied === label) copied = "";
      }, 1800);
    } catch {
      copied = "Copy failed";
    }
  }
</script>

<svelte:head>
  <title>{catalog.product} Agent Catalog</title>
  <meta name="description" content="Browse and deploy PDS Project AI agents for Microsoft Copilot Studio." />
</svelte:head>

<header class="masthead">
  <a class="brand" href={resolve("/")} aria-label="PDS Project AI agent catalog home">
    <span class="brand-mark">PDS</span>
    <span>Project AI <strong>Assets</strong></span>
  </a>
  <a class="repo-link" href={repositoryUrl} target="_blank" rel="noreferrer">
    Source repository <ExternalLink size={15} />
  </a>
</header>

<main>
  <section class="intro">
    <div>
      <p class="eyebrow">Copilot Studio deployment library</p>
      <h1>Choose the right project agent.</h1>
      <p class="lede">Production-ready instructions, workflows, templates, and deployment guidance for working with Microsoft Project data through PDS Project AI.</p>
    </div>
    <dl class="catalog-facts">
      <div><dt>Agents</dt><dd>{catalog.agents.length}</dd></div>
      <div><dt>Contract</dt><dd>v{catalog.mcpContractVersion}</dd></div>
      <div><dt>Catalog</dt><dd>v{catalog.catalogVersion}</dd></div>
    </dl>
  </section>

  <section class="workspace" aria-labelledby="catalog-heading">
    <div class="toolbar">
      <div>
        <p class="section-index">01 / Agent catalog</p>
        <h2 id="catalog-heading">Available agents</h2>
      </div>
      <div class="controls">
        <label class="search-field">
          <span class="sr-only">Search agents and skills</span>
          <Search size={18} />
          <input bind:value={query} type="search" placeholder="Search agents or skills" />
        </label>
        <div class="segments" aria-label="Filter by access level">
          {#each [{ value: "all", label: "All" }, { value: "read-only", label: "Read only" }, { value: "commit", label: "Can commit" }] as option (option.value)}
            <button class:active={access === option.value} onclick={() => access = option.value as typeof access}>{option.label}</button>
          {/each}
        </div>
      </div>
    </div>

    <p class="result-count">{filteredAgents.length} {filteredAgents.length === 1 ? "agent" : "agents"}</p>
    <div class="agent-grid">
      {#each filteredAgents as agent (agent.name)}
        <article class="agent-card">
          <div class="card-topline">
            <span class:commit={agent.access === "commit"} class="access-badge">
              <ShieldCheck size={14} /> {agent.access === "commit" ? "Guarded commit" : "Read only"}
            </span>
            <span class="target-count">{agent.authoringTargets.length} {agent.authoringTargets.length === 1 ? "target" : "targets"}</span>
          </div>
          <h3>{agent.title}</h3>
          <p>{agent.description}</p>
          <div class="skill-list" aria-label={`${agent.title} skills`}>
            {#each agent.skills.slice(0, 4) as skill (skill.name)}
              <span>{skill.name.replace("mpp-", "")}</span>
            {/each}
            {#if agent.skills.length > 4}<span>+{agent.skills.length - 4}</span>{/if}
          </div>
          <div class="card-actions">
            <button class="details-button" onclick={() => openAgent(agent)}>Deployment details <ChevronRight size={17} /></button>
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a class="download-button" href={downloadUrl(agent)} aria-label={`Download ${agent.title} package`} title="Download latest package">
              <Download size={18} />
            </a>
          </div>
        </article>
      {/each}
    </div>
    {#if filteredAgents.length === 0}
      <div class="empty-state"><p>No agents match those filters.</p><button onclick={() => { query = ""; access = "all"; }}>Clear filters</button></div>
    {/if}
  </section>

  <section class="deployment-band" aria-labelledby="deploy-heading">
    <p class="section-index">02 / Deployment path</p>
    <h2 id="deploy-heading">From package to working agent</h2>
    <ol>
      <li><span>01</span><div><strong>Choose and download</strong><p>Select the agent closest to the operational role and download its latest ZIP package.</p></div></li>
      <li><span>02</span><div><strong>Configure in development</strong><p>Use the included BotDefinition where available, or follow the manual Copilot Studio setup guide.</p></div></li>
      <li><span>03</span><div><strong>Bind least privilege</strong><p>Connect the PDS Project AI MCP tool with read-only or read/write scope matching the agent.</p></div></li>
      <li><span>04</span><div><strong>Test, then publish</strong><p>Run the packaged evaluation cases against non-production MPP files before publishing.</p></div></li>
    </ol>
  </section>
</main>

{#if selected}
  {@const agent = selected}
  <div class="scrim" role="presentation" onclick={(event) => { if (event.target === event.currentTarget) selected = null; }}>
    <div class:skills-active={activeTab === "skills"} class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <header class="drawer-header">
        <div><p class="eyebrow">Deployment package</p><h2 id="drawer-title">{agent.title}</h2></div>
        <button class="icon-button" onclick={() => selected = null} aria-label="Close deployment details" title="Close"><X size={20} /></button>
      </header>
      <div class="drawer-meta">
        <span>{agent.access === "commit" ? "Session.ReadWrite" : "Session.ReadOnly"}</span>
        <span>{agent.skills.length} workflows</span>
        <span>{agent.authoringTargets.join(" + ")}</span>
      </div>
      {#if activeTab !== "skills"}
        <section class="drawer-skills" aria-labelledby="drawer-skills-title">
          <h3 id="drawer-skills-title">Included skills</h3>
          <ul>
            {#each agent.skills as skill (`${skill.category}:${skill.name}`)}
              <li>
                <button type="button" onclick={() => openSkill(skill)}>
                  <strong>{skill.name}</strong><span>{skill.category}</span>
                </button>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
      <div class="drawer-actions">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a class="primary-action" href={downloadUrl(agent)}><Download size={17} /> Download package</a>
        <button onclick={() => copyText("description", agent.description)}>
          {#if copied === "description"}<Check size={17} /> Copied{:else}<Copy size={17} /> Copy description{/if}
        </button>
      </div>
      <nav class="tabs" aria-label="Agent deployment content">
        <button aria-pressed={activeTab === "setup"} class:active={activeTab === "setup"} onclick={() => activeTab = "setup"}>Setup guide</button>
        <button aria-pressed={activeTab === "instructions"} class:active={activeTab === "instructions"} onclick={() => activeTab = "instructions"}>Agent Instructions</button>
        <button aria-pressed={activeTab === "skills"} class:active={activeTab === "skills"} onclick={() => activeTab = "skills"}>Skills ({agent.skills.length})</button>
        {#if agent.agentTemplate}<button aria-pressed={activeTab === "template"} class:active={activeTab === "template"} onclick={() => activeTab = "template"}>Agent YAML</button>{/if}
      </nav>
      {#if activeTab === "skills"}
        <div class="skills-browser">
          <ul class="skill-selector" aria-label="Select a skill to preview">
            {#each agent.skills as skill (`${skill.category}:${skill.name}`)}
              <li>
                <button type="button" aria-pressed={selectedSkill?.name === skill.name} class:active={selectedSkill?.name === skill.name} onclick={() => openSkill(skill)}>
                  <strong>{skill.name}</strong><span>{skill.category}</span>
                </button>
              </li>
            {/each}
          </ul>
          {#if selectedSkill}
            {@const skill = selectedSkill}
            <section class="skill-preview" aria-labelledby="skill-preview-title">
              <header>
                <div><p>{skill.category} / {skill.access}</p><h3 id="skill-preview-title">{skill.name}</h3></div>
                <button class="preview-copy-button" type="button" onclick={() => copyText(`skill:${skill.name}`, skill.content)}>
                  {#if copied === `skill:${skill.name}`}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy skill{/if}
                </button>
              </header>
              <article class="markdown-content">
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html renderMarkdown(skill.content)}
              </article>
            </section>
          {:else}
            <p class="skill-placeholder">Select a skill to preview its content.</p>
          {/if}
        </div>
      {:else}
        <div class="copy-panel">
          <button class="copy-button" onclick={() => copyText(activeTab, tabContent(agent))}>
            {#if copied === activeTab}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy all{/if}
          </button>
          {#if activeTab === "template"}
            <pre class="source-code">{tabContent(agent)}</pre>
          {:else}
            <article class="markdown-content">
              <!-- eslint-disable-next-line svelte/no-at-html-tags -->
              {@html renderMarkdown(tabContent(agent))}
            </article>
          {/if}
        </div>
      {/if}
      <p class="copy-status" aria-live="polite">{copied === "Copy failed" ? copied : ""}</p>
    </div>
  </div>
{/if}

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #f4f2ec; color: #17201d; font-family: "Aptos", "Segoe UI", sans-serif; }
  :global(body) { margin: 0; background: radial-gradient(circle at 90% 4%, rgba(236, 190, 72, 0.2), transparent 24rem), linear-gradient(90deg, rgba(23, 32, 29, 0.035) 1px, transparent 1px), #f4f2ec; background-size: auto, 48px 48px, auto; }
  :global(button), :global(input) { font: inherit; }
  :global(button), :global(a) { -webkit-tap-highlight-color: transparent; }
  .masthead { min-height: 72px; padding: 0 5vw; border-bottom: 1px solid #c9cbc4; display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 12px; color: inherit; text-decoration: none; font-family: Georgia, serif; font-size: 18px; }
  .brand-mark { background: #185845; color: white; padding: 8px 7px 7px; font: 700 13px/1 "Aptos", sans-serif; letter-spacing: 0; }
  .repo-link { color: #37453f; display: flex; align-items: center; gap: 6px; text-decoration: none; font-size: 14px; }
  main { width: min(1440px, 100%); margin: 0 auto; }
  .intro { min-height: 390px; padding: 78px 5vw 54px; display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(280px, 0.8fr); align-items: end; gap: 8vw; border-bottom: 1px solid #989f98; }
  .eyebrow, .section-index { margin: 0 0 14px; color: #8c4c20; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
  h1, h2, h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 400; letter-spacing: 0; }
  h1 { margin: 0; max-width: 760px; font-size: clamp(48px, 7vw, 92px); line-height: 0.96; }
  .lede { max-width: 760px; margin: 28px 0 0; color: #4d5854; font-size: 18px; line-height: 1.55; }
  .catalog-facts { margin: 0; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid #8c928d; }
  .catalog-facts div { padding: 20px 6px; border-bottom: 1px solid #c9cbc4; }
  .catalog-facts dt { color: #65706b; font-size: 11px; text-transform: uppercase; }
  .catalog-facts dd { margin: 7px 0 0; font: 30px Georgia, serif; }
  .workspace { padding: 58px 5vw 78px; }
  .toolbar { display: flex; justify-content: space-between; align-items: end; gap: 28px; }
  h2 { margin: 0; font-size: 38px; }
  .controls { display: flex; align-items: center; gap: 12px; }
  .search-field { width: min(310px, 34vw); min-height: 42px; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid #65706b; }
  .search-field input { width: 100%; border: 0; outline: 0; background: transparent; color: inherit; }
  .segments { display: flex; border: 1px solid #a8ada7; }
  .segments button { min-height: 40px; padding: 0 13px; border: 0; border-right: 1px solid #a8ada7; background: transparent; color: #4d5854; cursor: pointer; }
  .segments button:last-child { border-right: 0; }
  .segments button.active { background: #17201d; color: white; }
  .result-count { margin: 28px 0 12px; color: #65706b; font-size: 13px; }
  .agent-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #7e8680; border-left: 1px solid #c2c5bf; }
  .agent-card { min-height: 330px; padding: 24px; display: flex; flex-direction: column; border-right: 1px solid #c2c5bf; border-bottom: 1px solid #c2c5bf; background: rgba(250, 249, 245, 0.72); }
  .card-topline, .card-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .access-badge { display: inline-flex; align-items: center; gap: 5px; color: #185845; font-size: 12px; font-weight: 700; }
  .access-badge.commit { color: #a14322; }
  .target-count { color: #717a75; font-size: 12px; }
  .agent-card h3 { margin: 28px 0 10px; font-size: 27px; line-height: 1.08; }
  .agent-card > p { margin: 0; color: #56615c; line-height: 1.5; }
  .skill-list { margin: 22px 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .skill-list span { padding: 4px 7px; background: #e6e7e1; color: #4f5a55; font-size: 11px; }
  .card-actions { margin-top: auto; padding-top: 18px; border-top: 1px solid #d1d3ce; }
  .details-button, .download-button, .drawer-actions a, .drawer-actions button { border: 0; background: transparent; color: #17201d; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; font-weight: 700; }
  .download-button { width: 38px; height: 38px; justify-content: center; border: 1px solid #aeb3ad; }
  .empty-state { padding: 70px; text-align: center; border: 1px solid #c2c5bf; }
  .empty-state button { border: 0; border-bottom: 1px solid; background: none; cursor: pointer; }
  .deployment-band { margin: 0 5vw 72px; padding: 48px; background: #173f35; color: #f7f4e9; }
  .deployment-band .section-index { color: #eaba4a; }
  .deployment-band ol { margin: 42px 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #698078; }
  .deployment-band li { padding: 23px 22px 0 0; display: grid; grid-template-columns: 34px 1fr; gap: 8px; }
  .deployment-band li > span { color: #eaba4a; font-size: 12px; }
  .deployment-band strong { font-family: Georgia, serif; font-size: 19px; font-weight: 400; }
  .deployment-band li p { color: #bfd0c9; font-size: 14px; line-height: 1.5; }
  .scrim { position: fixed; inset: 0; z-index: 10; padding: 24px; display: flex; align-items: center; justify-content: center; background: rgba(12, 20, 17, 0.66); }
  .drawer { width: min(1440px, 100%); height: calc(100dvh - 48px); overflow: hidden; padding: 32px; display: flex; flex-direction: column; background: #f7f5ef; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28); }
  .drawer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
  .drawer-header h2 { font-size: 34px; }
  .icon-button { width: 40px; height: 40px; border: 1px solid #b8bcb6; display: grid; place-items: center; background: transparent; cursor: pointer; }
  .drawer-meta { margin: 22px 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .drawer-meta span { padding: 6px 9px; background: #e3e5de; font-size: 12px; }
  .drawer-skills { margin: 0 0 24px; padding: 18px 0; border-top: 1px solid #c9ccc6; border-bottom: 1px solid #c9ccc6; }
  .drawer-skills h3 { margin: 0 0 12px; font: 16px "Aptos", "Segoe UI", sans-serif; font-weight: 700; }
  .drawer-skills ul { margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 7px; list-style: none; }
  .drawer-skills li { display: contents; }
  .drawer-skills li button { padding: 7px 9px; display: inline-flex; align-items: center; gap: 7px; border: 0; background: #e3e5de; color: inherit; font-size: 12px; cursor: pointer; }
  .drawer-skills li button:hover { background: #d5dad3; }
  .drawer-skills li span { color: #68726d; text-transform: uppercase; font-size: 10px; }
  .drawer-actions { display: flex; gap: 10px; }
  .drawer-actions a, .drawer-actions button { min-height: 42px; padding: 0 14px; border: 1px solid #9da39d; }
  .drawer-actions .primary-action { background: #185845; border-color: #185845; color: white; }
  .tabs { margin-top: 30px; display: flex; border-bottom: 1px solid #afb4ae; }
  .tabs button { padding: 13px 16px; border: 0; border-bottom: 3px solid transparent; background: transparent; cursor: pointer; }
  .tabs button.active { border-color: #a14322; font-weight: 700; }
  .copy-panel { position: relative; flex: 1; min-height: 0; margin-top: 18px; }
  .copy-button { position: absolute; top: 10px; right: 10px; padding: 8px 10px; display: flex; gap: 6px; border: 1px solid #5c6964; background: #f7f5ef; cursor: pointer; }
  .copy-panel > .markdown-content, .copy-panel > .source-code { height: 100%; }
  .skills-browser { flex: 1; min-height: 0; margin-top: 18px; display: grid; grid-template-columns: minmax(250px, 28%) minmax(0, 1fr); gap: 18px; }
  .skill-selector { min-height: 0; margin: 0; padding: 0; overflow: auto; border: 1px solid #b8bcb6; list-style: none; }
  .skill-selector li + li { border-top: 1px solid #d0d3cd; }
  .skill-selector button { width: 100%; padding: 13px 14px; border: 0; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .skill-selector button:hover { background: #e9e9e3; }
  .skill-selector button.active { background: #173f35; color: white; }
  .skill-selector span { color: #68726d; text-transform: uppercase; font-size: 10px; }
  .skill-selector button.active span { color: #c7d5d0; }
  .skill-preview { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  .skill-preview header { min-height: 62px; padding: 0 0 12px; display: flex; align-items: end; justify-content: space-between; gap: 18px; }
  .skill-preview header p { margin: 0 0 4px; color: #68726d; text-transform: uppercase; font-size: 10px; }
  .skill-preview h3 { margin: 0; font: 700 16px "Aptos", "Segoe UI", sans-serif; }
  .preview-copy-button { min-height: 38px; padding: 0 12px; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; border: 1px solid #5c6964; background: transparent; cursor: pointer; }
  .skill-preview .markdown-content { flex: 1; min-height: 0; }
  .skill-placeholder { margin: 0; padding: 30px; border: 1px solid #b8bcb6; color: #68726d; }
  .source-code { min-height: 260px; margin: 0; padding: 58px 20px 24px; overflow: auto; border: 1px solid #b8bcb6; background: #e9e9e3; color: #26322e; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.6 Consolas, monospace; }
  .markdown-content { min-height: 260px; padding: 28px 34px 48px; overflow: auto; border: 1px solid #b8bcb6; background: #fcfbf7; color: #2d3834; font-size: 15px; line-height: 1.68; }
  .markdown-content :global(h1), .markdown-content :global(h2), .markdown-content :global(h3), .markdown-content :global(h4) { color: #17201d; font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
  .markdown-content :global(h1) { margin: 0 0 24px; padding-bottom: 15px; border-bottom: 2px solid #185845; font-size: 32px; line-height: 1.15; }
  .markdown-content :global(h2) { margin: 36px 0 15px; padding-bottom: 9px; border-bottom: 1px solid #c7cbc5; font-size: 24px; line-height: 1.2; }
  .markdown-content :global(h3) { margin: 28px 0 10px; font-size: 19px; line-height: 1.3; }
  .markdown-content :global(h4) { margin: 22px 0 8px; font-size: 16px; font-weight: 700; }
  .markdown-content :global(p) { margin: 0 0 14px; }
  .markdown-content :global(ul), .markdown-content :global(ol) { margin: 0 0 18px; padding-left: 26px; }
  .markdown-content :global(li) { margin: 5px 0; padding-left: 3px; }
  .markdown-content :global(a) { color: #14624c; text-decoration-thickness: 1px; text-underline-offset: 3px; }
  .markdown-content :global(blockquote) { margin: 20px 0; padding: 12px 18px; border-left: 4px solid #d4a136; background: #f3efe2; color: #4c5853; }
  .markdown-content :global(blockquote p:last-child) { margin-bottom: 0; }
  .markdown-content :global(code) { padding: 2px 5px; background: #e7e9e3; color: #8c3d22; font: 0.88em/1.5 Consolas, monospace; }
  .markdown-content :global(pre) { margin: 18px 0; padding: 18px 20px; overflow: auto; border-left: 4px solid #d4a136; background: #1d2925; color: #e9eee9; white-space: pre; font: 12px/1.65 Consolas, monospace; }
  .markdown-content :global(pre code) { padding: 0; background: transparent; color: inherit; font: inherit; }
  .markdown-content :global(table) { width: 100%; margin: 20px 0 24px; border-collapse: collapse; font-size: 13px; }
  .markdown-content :global(th), .markdown-content :global(td) { padding: 10px 12px; border: 1px solid #c9cdc7; text-align: left; vertical-align: top; }
  .markdown-content :global(th) { background: #dfe6e1; color: #173f35; font-weight: 700; }
  .markdown-content :global(tr:nth-child(even) td) { background: #f1f2ed; }
  .markdown-content :global(hr) { margin: 30px 0; border: 0; border-top: 1px solid #bdc3bd; }
  .markdown-content :global(>:first-child) { margin-top: 0; }
  .markdown-content :global(>:last-child) { margin-bottom: 0; }
  .copy-status { min-height: 20px; color: #a14322; font-size: 12px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
  @media (max-width: 980px) { .intro { grid-template-columns: 1fr; } .catalog-facts { max-width: 460px; } .toolbar, .controls { align-items: stretch; flex-direction: column; } .search-field { width: 100%; } .agent-grid { grid-template-columns: repeat(2, 1fr); } .deployment-band ol { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 640px) { .masthead { padding: 0 20px; } .repo-link { font-size: 0; } .intro { min-height: 0; padding: 54px 20px 40px; } h1 { font-size: 48px; } .lede { font-size: 16px; } .workspace { padding: 44px 20px 60px; } .segments { width: 100%; } .segments button { flex: 1; padding: 0 7px; } .agent-grid { grid-template-columns: 1fr; } .agent-card { min-height: 300px; } .deployment-band { margin: 0; padding: 42px 20px; } .deployment-band ol { grid-template-columns: 1fr; } .scrim { padding: 0; } .drawer { width: 100%; height: 100dvh; padding: 24px 18px; } .drawer.skills-active .drawer-meta, .drawer.skills-active .drawer-actions { display: none; } .drawer-actions { flex-wrap: wrap; } .tabs { overflow-x: auto; flex: 0 0 auto; } .tabs button { white-space: nowrap; } .drawer-skills { max-height: 26dvh; overflow: auto; } .skills-browser { overflow: hidden; grid-template-columns: 1fr; grid-template-rows: 160px minmax(0, 1fr); } .skill-preview header { align-items: center; } .markdown-content { padding: 22px 18px 36px; font-size: 14px; } .markdown-content :global(table) { display: block; overflow-x: auto; } }
</style>