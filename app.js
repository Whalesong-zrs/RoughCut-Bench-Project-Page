const state = {
  leaderboardData: null,
  visualData: null,
  speechData: null,
  activeViewId: "visual-annotation",
  activeSetId: "set1",
  sortKey: "f1",
  sortDirection: "desc",
  activeCategoryId: "quality-progression",
  activeCaseId: "bakery-cafe",
};

const elements = {
  leaderboardViewTabs: document.querySelector("#leaderboard-view-tabs"),
  leaderboardSetTabs: document.querySelector("#leaderboard-set-tabs"),
  leaderboardRankLabel: document.querySelector("#leaderboard-rank-label"),
  leaderboardDescription: document.querySelector("#leaderboard-description"),
  leaderboardTable: document.querySelector("#leaderboard-table"),
  categoryTabs: document.querySelector("#case-category-tabs"),
  caseTabs: document.querySelector("#case-tabs"),
  categorySummary: document.querySelector("#case-category-summary"),
  caseContent: document.querySelector("#case-content"),
};

function makeElement(tag, className, textContent) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function makeIcon(name) {
  const icon = document.createElement("i");
  icon.dataset.lucide = name;
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function makeTab(label, isSelected, onClick) {
  const button = makeElement("button", null, label);
  button.type = "button";
  button.role = "tab";
  button.setAttribute("aria-selected", String(isSelected));
  button.addEventListener("click", onClick);
  return button;
}

function getActiveView() {
  return state.leaderboardData.views.find((view) => view.id === state.activeViewId);
}

function getActiveSet() {
  return getActiveView().sets.find((set) => set.id === state.activeSetId);
}

function renderLeaderboardViewTabs() {
  elements.leaderboardViewTabs.replaceChildren();

  state.leaderboardData.views.forEach((view) => {
    elements.leaderboardViewTabs.append(
      makeTab(view.label, view.id === state.activeViewId, () => {
        state.activeViewId = view.id;
        state.activeSetId = view.defaultSet;
        const activeSet = view.sets.find((set) => set.id === state.activeSetId);
        state.sortKey = activeSet.defaultSort;
        state.sortDirection = "desc";
        renderLeaderboard();
      }),
    );
  });
}

function renderLeaderboardSetTabs() {
  const view = getActiveView();
  elements.leaderboardSetTabs.replaceChildren();

  view.sets.forEach((set) => {
    elements.leaderboardSetTabs.append(
      makeTab(set.label, set.id === state.activeSetId, () => {
        state.activeSetId = set.id;
        state.sortKey = set.defaultSort;
        state.sortDirection = "desc";
        renderLeaderboardSetTabs();
        renderLeaderboardTable();
      }),
    );
  });
}

function formatMetric(value, column) {
  if (typeof value !== "number") return "—";
  if (column.digits !== undefined) return value.toFixed(column.digits);
  return value.toFixed(state.activeViewId === "visual-quality" ? 2 : 3);
}

function renderLeaderboardTable() {
  const view = getActiveView();
  const set = getActiveSet();
  const sortColumn = set.columns.find((column) => column.key === state.sortKey);
  const sortedRows = [...set.rows].sort((left, right) => {
    const difference = left[state.sortKey] - right[state.sortKey];
    if (difference === 0) return left.model.localeCompare(right.model);
    return state.sortDirection === "desc" ? -difference : difference;
  });

  const maxima = Object.fromEntries(
    set.columns.map((column) => [
      column.key,
      Math.max(...set.rows.map((row) => row[column.key])),
    ]),
  );

  elements.leaderboardDescription.textContent = view.description;
  elements.leaderboardRankLabel.textContent =
    `Ranked by ${sortColumn.label} · ${state.sortDirection === "desc" ? "high to low" : "low to high"}`;

  const table = makeElement("table", "leaderboard-table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.append(makeElement("th", null, "Rank"));
  headRow.append(makeElement("th", null, "Model"));

  set.columns.forEach((column) => {
    const header = document.createElement("th");
    const button = makeElement("button", "sort-button", column.label);
    button.type = "button";
    button.title = `Sort by ${column.label}`;
    button.classList.toggle("active", state.sortKey === column.key);
    button.classList.toggle(
      "ascending",
      state.sortKey === column.key && state.sortDirection === "asc",
    );
    button.addEventListener("click", () => {
      if (state.sortKey === column.key) {
        state.sortDirection = state.sortDirection === "desc" ? "asc" : "desc";
      } else {
        state.sortKey = column.key;
        state.sortDirection = "desc";
      }
      renderLeaderboardTable();
    });
    header.append(button);
    headRow.append(header);
  });

  head.append(headRow);
  table.append(head);

  const body = document.createElement("tbody");
  sortedRows.forEach((row, index) => {
    const tableRow = document.createElement("tr");
    tableRow.className = `family-${row.family}`;
    tableRow.append(makeElement("td", "rank-cell", String(index + 1)));
    tableRow.append(makeElement("td", null, row.model));

    set.columns.forEach((column) => {
      const cell = makeElement("td", null, formatMetric(row[column.key], column));
      if (row[column.key] === maxima[column.key]) {
        cell.classList.add("metric-best");
      }
      tableRow.append(cell);
    });
    body.append(tableRow);
  });

  table.append(body);
  elements.leaderboardTable.replaceChildren(table);
}

function renderLeaderboard() {
  renderLeaderboardViewTabs();
  renderLeaderboardSetTabs();
  renderLeaderboardTable();
}

function getExplorerCategories() {
  return [
    ...state.visualData.categories.map((category) => ({ ...category, type: "visual" })),
    { ...state.speechData.category, type: "speech" },
  ];
}

function getActiveCategory() {
  return getExplorerCategories().find((category) => category.id === state.activeCategoryId);
}

function getActiveCase() {
  return getActiveCategory().cases.find((caseData) => caseData.id === state.activeCaseId);
}

function stopAllMedia() {
  document.querySelectorAll("video, audio").forEach((media) => {
    media.pause();
  });
}

function renderCategoryTabs() {
  elements.categoryTabs.replaceChildren();
  getExplorerCategories().forEach((category) => {
    elements.categoryTabs.append(
      makeTab(category.label, category.id === state.activeCategoryId, () => {
        stopAllMedia();
        state.activeCategoryId = category.id;
        state.activeCaseId = category.cases[0].id;
        renderExplorer();
      }),
    );
  });
}

function renderCaseTabs() {
  const category = getActiveCategory();
  elements.caseTabs.replaceChildren();
  elements.categorySummary.textContent = category.summary;

  category.cases.forEach((caseData, index) => {
    elements.caseTabs.append(
      makeTab(`Case ${index + 1}`, caseData.id === state.activeCaseId, () => {
        stopAllMedia();
        state.activeCaseId = caseData.id;
        renderCaseTabs();
        renderCaseContent();
      }),
    );
  });
}

function makeCaseHeader(caseData, category) {
  const header = makeElement("div", "case-header");
  const headingGroup = document.createElement("div");
  const title = makeElement("h3", null, caseData.title);
  const meta = makeElement("div", "case-meta");
  meta.append(makeElement("span", "badge", caseData.domain || caseData.scenario || category.label));

  if (caseData.privacyReviewed) {
    meta.append(makeElement("span", "privacy-badge", "Privacy reviewed"));
  }
  if (caseData.focus) {
    meta.append(makeElement("span", "badge", `Focus: ${caseData.focus}`));
  }
  if (caseData.selectionRule) {
    meta.append(makeElement("span", "badge", caseData.selectionRule));
  }
  headingGroup.append(title, meta);
  header.append(headingGroup);

  if (caseData.scoreNote || caseData.privacyNote) {
    header.append(
      makeElement("p", "case-note", caseData.scoreNote || caseData.privacyNote),
    );
  }
  return header;
}

function makeVideoCard(media, secondaryLabel) {
  const card = makeElement("article", "media-item");
  const frame = makeElement("div", "media-frame");
  const video = document.createElement("video");
  video.controls = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "none";
  video.src = media.src;
  if (media.poster) video.poster = media.poster;
  video.setAttribute("aria-label", media.label || secondaryLabel || "Video");
  frame.append(video);

  const label = makeElement("div", "media-label");
  label.append(makeElement("strong", null, media.label || secondaryLabel || "Video"));
  if (secondaryLabel) label.append(makeElement("span", null, secondaryLabel));

  if (media.metrics) {
    const chips = makeElement("div", "metric-chips");
    Object.entries(media.metrics).forEach(([key, value]) => {
      chips.append(makeElement("span", "metric-chip", `${key} ${Number(value).toFixed(2)}`));
    });
    label.append(chips);
  }
  card.append(frame, label);
  return card;
}

function makePendingPanel(caseData) {
  const panel = makeElement("div", "pending-panel");
  const inner = makeElement("div", "pending-panel-inner");
  inner.append(
    makeIcon("shield-check"),
    makeElement("h4", null, "Media pending privacy review"),
    makeElement(
      "p",
      null,
      "This case slot is reserved, but its source and output media will remain unavailable until privacy screening and public-release clearance are complete.",
    ),
  );

  if (caseData.requirement) {
    inner.append(
      makeElement("p", "case-note pending-note", `Requirement: ${caseData.requirement}`),
    );
  } else if (caseData.selectionRule) {
    inner.append(
      makeElement("p", "case-note pending-note", `Selection rule: ${caseData.selectionRule}`),
    );
  }
  panel.append(inner);
  return panel;
}

function renderVisualCase(caseData, category) {
  const fragment = document.createDocumentFragment();
  fragment.append(makeCaseHeader(caseData, category));

  if (caseData.requirement) {
    const requirement = makeElement("div", "requirement-band");
    requirement.append(makeElement("strong", null, "User requirement: "));
    requirement.append(document.createTextNode(caseData.requirement));
    fragment.append(requirement);
  }

  if (!caseData.privacyReviewed || !caseData.sourceVideos?.length) {
    fragment.append(makePendingPanel(caseData));
    return fragment;
  }

  const sourceSection = makeElement("section", "media-section");
  sourceSection.append(makeElement("h4", null, "Source videos"));
  const strip = makeElement("div", "source-strip");
  caseData.sourceVideos.forEach((video) => strip.append(makeVideoCard(video)));
  sourceSection.append(strip);

  const comparisonSection = makeElement("section", "media-section");
  comparisonSection.append(makeElement("h4", null, "Reference and model outputs"));
  const comparison = makeElement("div", "comparison-grid");
  const comparisonCount = (caseData.reference ? 1 : 0) + caseData.predictions.length;
  if (comparisonCount === 2) comparison.classList.add("comparison-grid-pair");
  if (caseData.reference) {
    comparison.append(makeVideoCard(caseData.reference, "Professional cut"));
  }
  caseData.predictions.forEach((prediction) => {
    const secondaryLabel = prediction.displayModelOnly
      ? undefined
      : [prediction.label, prediction.model].filter(Boolean).join(" · ");
    comparison.append(makeVideoCard(prediction, secondaryLabel));
  });
  comparisonSection.append(comparison);

  fragment.append(sourceSection, comparisonSection);
  return fragment;
}

function appendTranscriptContent(container, segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    container.textContent = "Transcript pending release.";
    return;
  }

  segments.forEach((segment) => {
    const text = typeof segment === "string" ? segment : segment.text;
    const type = typeof segment === "string" ? null : segment.type?.toLowerCase();
    const span = makeElement("span", type ? `transcript-span label-${type}` : null, text);
    container.append(span);
  });
}

function makeTranscriptPanel(title, content) {
  const panel = makeElement("article", "transcript-panel");
  panel.append(makeElement("h4", null, title));
  const text = makeElement("p", "transcript-text");
  if (Array.isArray(content)) {
    appendTranscriptContent(text, content);
  } else {
    text.textContent = content || "Transcript pending release.";
  }
  panel.append(text);
  return panel;
}

function makeModelTracePanel(caseData) {
  const panel = makeElement("article", "transcript-panel model-trace-panel");
  panel.append(makeElement("h4", null, caseData.model || "Model Output"));

  const body = makeElement("div", "transcript-text model-trace-body");
  body.append(makeElement("h5", "trace-heading", "Cleaned transcript"));
  const cleaned = makeElement("div", "retained-output");
  cleaned.append(
    makeElement("span", "trace-label label-r", "R"),
    makeElement("p", null, caseData.modelTranscript || "Transcript pending release."),
  );
  body.append(cleaned);

  body.append(makeElement("h5", "trace-heading edit-heading", "Model edit trace"));

  (caseData.modelEdits || []).forEach((edit) => {
    const rawType = (edit.type || "").toLowerCase();
    const displayType = rawType === "c" ? "rm" : rawType;
    const label = rawType === "c" ? "RM→R" : rawType.toUpperCase();
    const item = makeElement("div", `edit-trace-item trace-${displayType}`);
    const itemHeader = makeElement("div", "edit-trace-header");
    itemHeader.append(
      makeElement("span", `trace-label label-${displayType}`, label),
      makeElement("span", "trace-action", rawType === "c" ? "Replaced" : "Removed"),
    );
    item.append(itemHeader, makeElement("p", "edit-trace-copy", edit.text));

    if (edit.kept) {
      const retained = makeElement("div", "edit-kept");
      retained.append(
        makeElement("span", "trace-label label-r", "R"),
        makeElement("span", null, edit.kept),
      );
      item.append(retained);
    }
    body.append(item);
  });
  panel.append(body);
  return panel;
}

function renderSpeechCase(caseData, category) {
  const fragment = document.createDocumentFragment();
  fragment.append(makeCaseHeader(caseData, category));

  if (!caseData.privacyReviewed) {
    fragment.append(makePendingPanel(caseData));
    return fragment;
  }

  const legend = makeElement("div", "transcript-legend", null);
  [
    ["label-im", "IM · filler"],
    ["label-rm", "RM · removed expression"],
    ["label-r", "R · retained expression"],
    ["label-d", "D · low-value span"],
  ].forEach(([className, label]) => legend.append(makeElement("span", className, label)));

  const metricChips = makeElement("div", "metric-chips");
  Object.entries(caseData.metrics || {}).forEach(([key, value]) => {
    metricChips.append(makeElement("span", "metric-chip", `${key} ${Number(value).toFixed(3)}`));
  });

  const scrollHint = makeElement("p", "scroll-hint");
  scrollHint.append(
    makeIcon("chevrons-up-down"),
    document.createTextNode("Scroll within each panel to view the complete transcript and edit trace."),
  );

  const grid = makeElement("div", "transcript-grid");
  grid.append(
    makeTranscriptPanel("Original ASR with annotations", caseData.originalSegments),
    makeTranscriptPanel("Professional Reference", caseData.referenceTranscript),
    makeModelTracePanel(caseData),
  );
  fragment.append(legend, metricChips, scrollHint, grid);
  return fragment;
}

function renderCaseContent() {
  const category = getActiveCategory();
  const caseData = getActiveCase();
  const content =
    category.type === "speech"
      ? renderSpeechCase(caseData, category)
      : renderVisualCase(caseData, category);
  elements.caseContent.replaceChildren(content);
  refreshIcons();
}

function renderExplorer() {
  renderCategoryTabs();
  renderCaseTabs();
  renderCaseContent();
}

function renderLoadError(error) {
  const message = makeElement("div", "pending-panel");
  const inner = makeElement("div", "pending-panel-inner");
  inner.append(
    makeIcon("triangle-alert"),
    makeElement("h4", null, "Project data could not be loaded"),
    makeElement("p", null, "Reload the page or serve the project through a local web server."),
  );
  message.append(inner);
  elements.leaderboardTable.replaceChildren(message.cloneNode(true));
  elements.caseContent.replaceChildren(message);
  refreshIcons();
  console.error(error);
}

async function initialize() {
  try {
    const [leaderboardResponse, visualResponse, speechResponse] = await Promise.all([
      fetch("data/leaderboards.json"),
      fetch("data/visual_cases.json"),
      fetch("data/speech_cases.json"),
    ]);

    if (![leaderboardResponse, visualResponse, speechResponse].every((response) => response.ok)) {
      throw new Error("One or more project data files returned an error.");
    }

    [state.leaderboardData, state.visualData, state.speechData] = await Promise.all([
      leaderboardResponse.json(),
      visualResponse.json(),
      speechResponse.json(),
    ]);

    renderLeaderboard();
    renderExplorer();
    refreshIcons();
  } catch (error) {
    renderLoadError(error);
  }
}

initialize();
