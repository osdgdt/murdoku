import { el, clear, qs, attachHoldToConfirm, onActivateKey } from "../util/dom.js";
import { characterIcon } from "../model/icons.js";
import { zoneOfCell } from "../model/grid.js";
import { characterColor, cluesForCharacter } from "../model/puzzle.js";
import { describeClue } from "../model/clueTypes.js";
import { handleCellTap, handleCellHold, handleCellDrag, undo, clearAll, renderPlayerBoard } from "./board.js";
import { renderClueCards } from "./clueCards.js";
import { validateSolution } from "../solver/validator.js";
import { computeHintChainAsync, deriveSolutionAsync, checkUniquenessAsync } from "../solver/solverClient.js";
import { resolveClueHoverCells } from "../solver/hoverTargets.js";
import { formatElapsed } from "../util/time.js";
import * as achievementsStore from "../storage/achievementsStore.js";

// Which computeHintChain step types count as "a hint actually helped" — see
// onHint() below. tooComplex/noHint alone disclose zero new information
// about the puzzle, so they don't cost the player their "solved without
// hints" achievement.
const REAL_HINT_STEP_TYPES = new Set(["forcedPlacement", "eliminatedCell", "contradiction"]);

const SOLUTION_UNSATISFIABLE_MSG =
  "Gli indizi di questo caso non ammettono nessuna soluzione: il caso non può essere risolto così com'è. Se sei l'autore, correggilo nell'editor.";
const SOLUTION_AMBIGUOUS_MSG =
  "Gli indizi di questo caso ammettono più soluzioni diverse: non è possibile stabilire con certezza quale sia quella corretta. Se sei l'autore, usa \"Verifica unicità\" nell'editor per individuare l'ambiguità.";
const SOLUTION_INCONCLUSIVE_MSG =
  "Non riesco a stabilire con certezza la soluzione di questo caso: gli indizi lasciano lo spazio di ricerca troppo ampio anche per un'analisi approfondita. Se sei l'autore, aggiungi indizi più stringenti.";

// Shared orchestration for a single puzzle-solving screen: toolbar, timer,
// hint-chain stepping, and submit-check. player.html and campaign.html's
// game screen were otherwise character-for-character identical here — the
// only real differences are WHERE a board snapshot gets saved (localStorage
// vs debounced Firestore) and what happens on a correct solve (mark a local
// puzzle completed vs call Firestore's markCaseCompleted), both captured as
// the `persistProgress`/`onSolved` callbacks instead of two parallel copies
// of this file. `achievementKey` is a third small per-caller input: a
// stable string identifying THIS puzzle for achievementsStore.recordSolve
// (`puzzle:<id>` for a standalone puzzle, `campaign:<campaignId>:<caseId>`
// for a campaign case) — gameScreen.js itself has no notion of which
// campaign/case a puzzle came from, only the caller does.
//
// Queries its own DOM refs by id rather than taking them as a parameter —
// player.html and campaign.html deliberately use the exact same ids for
// every element this module touches (#player-toolbar, #board, #clues-panel,
// #briefing-panel, #result-panel, #undo-btn, #clear-btn, #hint-btn,
// #hint-panel, #submit-btn, #timer). Keep it that way if either page's
// markup changes. #notes-hint also exists in both pages but is a static
// instruction paragraph now (no mode toggle to reflect) — this module never
// touches it.
export function createGameScreen({ puzzle, state, persistProgress, onSolved, achievementKey }) {
  const toolbarEl = qs("#player-toolbar");
  const boardEl = qs("#board");
  const cluesEl = qs("#clues-panel");
  const briefingEl = qs("#briefing-panel");
  const resultEl = qs("#result-panel");
  const undoBtn = qs("#undo-btn");
  const clearBtn = qs("#clear-btn");
  const hintBtn = qs("#hint-btn");
  const hintPanel = qs("#hint-panel");
  const submitBtn = qs("#submit-btn");
  const timerEl = qs("#timer");

  let hintHighlight = null; // { cells: [{row,col,cls}] } | null — ephemeral, not part of board.js state
  let hintChain = [];
  let hintChainIndex = 0;
  let timerInterval = null;
  let startedAt = null; // hoisted out of startTimer so onSubmit can also read it, for the elapsed time passed to onSolved
  let effectiveSolutionPromise = null; // memoized Promise (not the resolved value) — see getEffectiveSolution()
  let solved = false; // true once onSubmit's win branch has fired — keeps "Verifica soluzione" disabled until a placement/note actually changes again

  // Budget for confirming an already clue-consistent declared solution is
  // also the UNIQUE one (see confirmDeclaredSolutionUnique below) — well
  // under deriveSolution.js's DERIVE_SOLUTION_MAX_NODES (10,000,000): with
  // forwardCheck:true this is still ~5x deeper than the editor's own
  // "Verifica unicità" click (UNIQUENESS_PREVIEW_MAX_NODES = 200,000,
  // without forward-checking), while staying an order of magnitude cheaper
  // than the full from-scratch derive it escalates to on the rare puzzle
  // this can't settle.
  const DECLARED_SOLUTION_CHECK_MAX_NODES = 1_000_000;

  // The answer key used for win-checking, the murderer reveal, and the
  // hint system's last-resort fallback. A declared solution that passes
  // validateSolution() (row/col-distinct, satisfies every clue) is only a
  // CANDIDATE, not a proof — validateSolution never checks uniqueness. An
  // author who never ran "Verifica unicità" in the editor could ship an
  // ambiguous puzzle; blindly trusting puzzle.solution.placements would then
  // mark a player's equally-valid alternative placement wrong and report an
  // arbitrary murderer among several valid ones. So a clue-consistent
  // declared solution is CONFIRMED, not trusted (confirmDeclaredSolutionUnique),
  // before being used. Anything else (missing, incomplete, or actually
  // wrong) falls back straight to deriving a solution from the clues
  // (deriveSolutionAsync, off the main thread, never from
  // puzzle.solution.placements). Computed lazily (only when onSubmit/onHint
  // first need it, not at start()) and memoized as an in-flight PROMISE, not
  // just the resolved value: onSubmit and onHint's extendChainWithOracleStep
  // can both need this close together, and memoizing the promise (rather
  // than waiting for one to resolve before deciding whether to start a
  // second) means they always share one call instead of racing into two
  // redundant ones.
  function getEffectiveSolution() {
    if (!effectiveSolutionPromise) {
      effectiveSolutionPromise = validateSolution(puzzle).valid
        ? confirmDeclaredSolutionUnique()
        : deriveSolutionAsync(puzzle).catch((err) => {
            // Don't freeze a transient failure (e.g. a worker hiccup) into a
            // permanent one for the rest of this page's life — let the next
            // attempt retry against a fresh worker.
            effectiveSolutionPromise = null;
            throw err;
          });
    }
    return effectiveSolutionPromise;
  }

  // checkUniqueness doesn't take the declared solution as a hint (no
  // fixedPlacements support) — it re-searches the clues from scratch, same
  // as deriveSolution would, just under a smaller node cap. solutionCount
  // can never be 0 here: validateSolution() already proved
  // puzzle.solution.placements itself is one valid solution.
  function confirmDeclaredSolutionUnique() {
    return checkUniquenessAsync(puzzle, { maxSolutions: 2, forwardCheck: true, maxNodes: DECLARED_SOLUTION_CHECK_MAX_NODES })
      .then((report) => {
        if (report.solutionCount >= 2) return { status: "ambiguous", placements: null };
        if (report.solutionCount === 1 && !report.truncated) {
          return { status: "unique", placements: puzzle.solution.placements };
        }
        // Cheap tier couldn't prove uniqueness or ambiguity (node-capped
        // before settling either way) — escalate instead of guessing.
        return deriveSolutionAsync(puzzle);
      })
      .catch((err) => {
        effectiveSolutionPromise = null;
        throw err;
      });
  }

  function startTimer() {
    startedAt = Date.now();
    timerEl.textContent = "⏱ 0:00";
    timerInterval = setInterval(() => {
      timerEl.textContent = `⏱ ${formatElapsed(Math.floor((Date.now() - startedAt) / 1000))}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Selecting a character also highlights their clue card and every candidate
  // mark they already have on the board (see renderClueCards/board.js), so
  // re-render both whenever the active tool changes.
  function selectTool(tool) {
    state.selectedTool = tool;
    renderToolbar();
    renderBoardAndClues();
  }

  function renderToolbar() {
    clear(toolbarEl);
    for (const character of puzzle.characters) {
      const placed = state.placements.has(character.id);
      const selectThis = () => selectTool({ kind: "character", id: character.id });
      const chip = el("div", {
        class: "char-chip" + (state.selectedTool?.kind === "character" && state.selectedTool.id === character.id ? " selected" : "") + (placed ? " used" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": character.name + (character.isVictim ? " (vittima)" : ""),
        onClick: selectThis,
        onKeydown: onActivateKey(selectThis),
        // Focus is the keyboard equivalent of hover here — tabbing to a chip
        // previews its clue targets on the board exactly like mousing over
        // it does, before committing with Enter/Space.
        onMouseenter: () => showCharacterHover(character.id),
        onMouseleave: clearHover,
        onFocus: () => showCharacterHover(character.id),
        onBlur: clearHover,
      });
      const iconWrap = el("span", { style: `color:${character.isVictim ? "var(--danger)" : characterColor(character)}` });
      iconWrap.innerHTML = characterIcon(character.isVictim ? "victim" : character.iconId).icon;
      chip.appendChild(iconWrap);
      if (!character.isVictim) chip.style.borderLeft = `3px solid ${characterColor(character)}`;
      chip.appendChild(document.createTextNode(character.name + (character.isVictim ? " (V)" : "")));
      toolbarEl.appendChild(chip);
    }
    const selectX = () => selectTool({ kind: "x" });
    const selectErase = () => selectTool({ kind: "erase" });
    toolbarEl.appendChild(el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "x" ? " selected" : ""),
      tabindex: "0", role: "button", "aria-label": "Segna X",
      onClick: selectX, onKeydown: onActivateKey(selectX),
    }, "✕ Segna"));
    toolbarEl.appendChild(el("div", {
      class: "char-chip" + (state.selectedTool?.kind === "erase" ? " selected" : ""),
      tabindex: "0", role: "button", "aria-label": "Gomma",
      onClick: selectErase, onKeydown: onActivateKey(selectErase),
    }, "🧹 Gomma"));
  }

  // Ephemeral, non-serialized cell highlighting for hover — mirrors
  // hintHighlight/applyHintHighlight below, but deliberately lighter-weight:
  // no full re-render, no dimming of the rest of the board (hover is a
  // frequent, transient touch, not a deliberate "look here" moment like a
  // hint). Classes are applied/removed directly on already-rendered nodes.
  function applyHoverCells(cells) {
    for (const { row, col } of cells) {
      const node = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (node) node.classList.add("hover-target");
    }
  }
  function clearHover() {
    boardEl.querySelectorAll(".hover-target").forEach((n) => n.classList.remove("hover-target"));
  }
  function showCharacterHover(characterId) {
    clearHover();
    applyHoverCells(cluesForCharacter(puzzle, characterId).flatMap((clue) => resolveClueHoverCells(clue, puzzle, state.placements)));
  }
  function showClueHover(clue) {
    clearHover();
    applyHoverCells(resolveClueHoverCells(clue, puzzle, state.placements));
  }

  // Dims every other cell while a hint is showing (see player.css) so the
  // highlighted one(s) can't get lost among character tokens, zone
  // textures, and wall borders on a busy board.
  function applyHintHighlight() {
    boardEl.classList.toggle("hint-active", !!hintHighlight);
    if (!hintHighlight) return;
    for (const { row, col, cls } of hintHighlight.cells) {
      const node = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      if (node) node.classList.add(cls);
    }
  }

  function clearHint() {
    hintHighlight = null;
    hintChain = [];
    hintChainIndex = 0;
    clear(hintPanel);
  }

  // Re-arms the submit button after a win — called from every handler that
  // can mutate state.placements/xMarks/candidates (tap, hold, drag, undo,
  // clear), since any of those can turn an already-solved board back into an
  // incomplete/wrong one (most directly: "Pulisci tutto" after a solve,
  // which this app explicitly still allows). Deliberately not called from
  // renderBoardAndClues() itself, which selectTool()/showHintStep() also
  // call without mutating anything — resetting there would re-arm the
  // button just by clicking a different character chip.
  function markUnsolved() {
    solved = false;
    submitBtn.disabled = false;
  }

  function renderBoardAndClues() {
    // Snapshotted at the instant a press begins (onPressStart, below) and
    // read back — instead of the live state.selectedTool — when the hold
    // timer actually fires: state.selectedTool can otherwise be reassigned
    // while a hold is still pending (e.g. showHintStep() auto-selecting a
    // character, reachable via a second touch on the hint nav while the
    // first is mid-hold on the board) — pinning it here is what makes
    // handleCellHold's own `tool` override meaningful.
    let pressStartTool = null;
    renderPlayerBoard(
      boardEl, puzzle, state,
      (row, col) => { // onCellTap — segna/toglie una nota (o X/gomma, invariati)
        clearHint();
        handleCellTap(state, puzzle.grid, row, col);
        markUnsolved();
        persistProgress();
        renderToolbar();
        renderBoardAndClues();
      },
      (row, col) => { // onCellHold — conferma qui il personaggio selezionato all'inizio della pressione
        clearHint();
        handleCellHold(state, puzzle.grid, row, col, pressStartTool);
        markUnsolved();
        persistProgress();
        renderToolbar();
        renderBoardAndClues();
      },
      (row, col) => { // onCellEnter — continuazione del trascinamento, note su più caselle
        handleCellDrag(state, puzzle.grid, row, col);
        markUnsolved();
        persistProgress();
        renderBoardAndClues();
      },
      () => { pressStartTool = state.selectedTool; } // onPressStart
    );
    applyHintHighlight();
    renderClueCards(cluesEl, puzzle, state, showClueHover, clearHover);
  }

  function murdererName(effective) {
    if (!effective || effective.status !== "unique") return null;
    const victim = puzzle.characters.find((c) => c.isVictim);
    if (!victim) return null;
    const vPlacement = effective.placements.find((p) => p.characterId === victim.id);
    if (!vPlacement) return null;
    const vZone = zoneOfCell(puzzle.grid, vPlacement.row, vPlacement.col);
    if (vZone === null) return null;
    const sameZoneChars = effective.placements.filter((p) => p.characterId !== victim.id && zoneOfCell(puzzle.grid, p.row, p.col) === vZone);
    if (sameZoneChars.length !== 1) return null;
    const murderer = puzzle.characters.find((c) => c.id === sameZoneChars[0].characterId);
    return murderer ? murderer.name : null;
  }

  // Renders the "Perché" explanation block under a hint step's banner: which
  // specific clues (by name, prefixed with the owning character when it's not
  // the step's own subject — e.g. a different character's directional clue can
  // be what forces THIS character's cell) make the deduction certain. Returns
  // null when there's nothing to add (result types other than
  // forcedPlacement/eliminatedCell/a clue-cause contradiction).
  function renderHintExplanation(result) {
    if (result.type === "contradiction" && result.cause === "clue") {
      return el("div", { class: "hint-explain" }, [
        el("div", { class: "hint-explain-label" }, "Indizio in conflitto:"),
        el("ul", { class: "hint-clue-list" }, result.clueIds.map((id) => {
          const clue = puzzle.clues.find((c) => c.id === id);
          if (!clue) return null;
          const owner = clue.characterId && puzzle.characters.find((c) => c.id === clue.characterId);
          return el("li", {}, (owner ? owner.name + ": " : "") + describeClue(clue, puzzle));
        })),
      ]);
    }
    if (result.type !== "forcedPlacement" && result.type !== "eliminatedCell") return null;
    if (result.viaDerivedSolution) {
      return el(
        "div",
        { class: "hint-explain" },
        el("p", { class: "hint-explain-note" }, "Questa deduzione non viene da un indizio specifico, ma da un'analisi completa e approfondita dell'intero caso.")
      );
    }
    if (result.jointlyDetermined) {
      return el("div", { class: "hint-explain" }, el("p", { class: "hint-explain-note" }, "Questa deduzione dipende dalla combinazione di più indizi insieme."));
    }
    const blocks = [];
    if (result.involvedClues?.length) {
      blocks.push(el("div", { class: "hint-explain-label" }, "Perché:"));
      blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedClues.map((c) => el("li", {}, (c.ownerName ? c.ownerName + ": " : "") + c.description))));
    }
    if (result.involvedGroups?.length) {
      // "Naked subset" deductions (see propagation.js): not caused by any one
      // clue, but by several characters' clue-narrowed domains jointly
      // leaving no room for anyone else in a shared set of cells.
      blocks.push(el("div", { class: "hint-explain-label" }, "Interazione tra personaggi:"));
      blocks.push(el("ul", { class: "hint-clue-list" }, result.involvedGroups.map((g) =>
        el("li", {}, `${g.characterNames.join(" e ")} possono stare solo in ${g.cellLabels.join(" o ")}: nessun altro personaggio può occupare quelle celle.`)
      )));
    }
    if (blocks.length === 0) return null;
    return el("div", { class: "hint-explain" }, blocks);
  }

  function showHintStep() {
    const result = hintChain[hintChainIndex];
    hintHighlight = null;

    if (result.type === "forcedPlacement") {
      hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-target" }] };
      state.selectedTool = { kind: "character", id: result.characterId };
    } else if (result.type === "eliminatedCell") {
      hintHighlight = { cells: [{ row: result.row, col: result.col, cls: "hint-info" }] };
    } else if (result.type === "contradiction" && result.culprits.length > 0) {
      hintHighlight = {
        cells: result.culprits.map((id) => state.placements.get(id)).filter(Boolean).map((pos) => ({ row: pos.row, col: pos.col, cls: "hint-culprit" })),
      };
      if (result.culprits.length === 1) state.selectedTool = { kind: "erase" };
    }

    clear(hintPanel);
    hintPanel.appendChild(el("div", { class: `result-banner hint-${result.variant}` }, result.message));
    const explanation = renderHintExplanation(result);
    if (explanation) hintPanel.appendChild(explanation);
    if (hintChain.length > 1) {
      hintPanel.appendChild(
        el("div", { class: "hint-nav" }, [
          el("button", { onClick: () => { hintChainIndex--; showHintStep(); }, disabled: hintChainIndex === 0 || undefined }, "‹"),
          el("span", {}, `Passo ${hintChainIndex + 1} di ${hintChain.length}`),
          el("button", { onClick: () => { hintChainIndex++; showHintStep(); }, disabled: hintChainIndex === hintChain.length - 1 || undefined }, "›"),
        ])
      );
    }
    renderToolbar();
    renderBoardAndClues();
  }

  // Extends a freshly-computed hint chain with exactly ONE additional
  // oracle-backed placement — never the rest of the solution at once — when
  // pure logical deduction (computeHintChain) hit a genuine "too complex"
  // wall but a deeper, one-time brute-force pass has ALSO established the
  // puzzle's unique solution. Mutates `chain` in place.
  //
  // Soundness: if computeHintChain didn't report a contradiction, the
  // player's current placements are consistent with the clues; if the
  // puzzle's clues admit only ONE full solution, any clue-consistent
  // assignment that can still be completed at all must be a subset of that
  // one true solution — so the revealed placement can never conflict with
  // anything the player (or an earlier step in this same chain) already
  // confirmed.
  async function extendChainWithOracleStep(chain) {
    const last = chain[chain.length - 1];
    if (!last || last.type !== "tooComplex") return; // only extend the honest "stuck" case
    const effective = await getEffectiveSolution();
    if (effective.status !== "unique") return; // never reveal a guess, only a proven answer

    const confirmed = new Map(state.placements);
    for (const step of chain) {
      if (step.type === "forcedPlacement") confirmed.set(step.characterId, { row: step.row, col: step.col });
    }
    // Deterministic, stable choice: first still-unplaced NON-victim character
    // in puzzle.characters order (falling back to the victim only once she's
    // the sole one left) — same "reveal her last, if possible" preference as
    // computeWave in hints.js, kept consistent across both hint paths.
    const next = puzzle.characters.find((c) => !confirmed.has(c.id) && !c.isVictim) || puzzle.characters.find((c) => !confirmed.has(c.id));
    if (!next) return; // defensive: shouldn't happen if the chain genuinely stopped early
    const target = effective.placements.find((p) => p.characterId === next.id);
    if (!target) return; // defensive

    const zoneId = zoneOfCell(puzzle.grid, target.row, target.col);
    const zone = zoneId && puzzle.grid.zones.find((z) => z.id === zoneId);
    const where = zone ? ` (nella zona "${zone.name}")` : "";
    chain.push({
      type: "forcedPlacement",
      variant: "success",
      characterId: next.id,
      row: target.row,
      col: target.col,
      viaDerivedSolution: true,
      message: `${next.name} deve trovarsi nella cella evidenziata${where}: lo rivela un'analisi completa del caso, non uno specifico indizio.`,
    });
  }

  async function onHint() {
    hintBtn.disabled = true;
    clear(hintPanel);
    hintPanel.appendChild(el("div", { class: "result-banner hint-info" }, "Sto calcolando un suggerimento…"));
    try {
      hintChain = await computeHintChainAsync(puzzle, state.placements, state.candidates);
      await extendChainWithOracleStep(hintChain);
      // Counts once per click that discloses something real — never for the
      // ‹ › nav buttons re-showing an already-computed chain (they call
      // showHintStep() directly, never onHint()).
      if (hintChain.some((step) => REAL_HINT_STEP_TYPES.has(step.type))) {
        state.hintsUsed++;
        persistProgress();
      }
      hintChainIndex = 0;
      showHintStep(); // already clears and re-renders hintPanel
    } catch (err) {
      clear(hintPanel);
      hintPanel.appendChild(el("div", { class: "result-banner hint-error" }, `Non sono riuscito a calcolare un suggerimento: ${err.message}. Riprova.`));
    } finally {
      hintBtn.disabled = false;
    }
  }

  async function onSubmit() {
    clear(resultEl);
    submitBtn.disabled = true;
    resultEl.appendChild(el("div", { class: "result-banner hint-info" }, "Sto verificando la soluzione…"));
    try {
      const effective = await getEffectiveSolution();
      clear(resultEl);
      if (effective.status !== "unique") {
        const message =
          effective.status === "unsatisfiable" ? SOLUTION_UNSATISFIABLE_MSG :
          effective.status === "ambiguous" ? SOLUTION_AMBIGUOUS_MSG :
          SOLUTION_INCONCLUSIVE_MSG;
        const cls = effective.status === "inconclusive" ? "hint-warning" : "hint-error";
        resultEl.appendChild(el("div", { class: `result-banner ${cls}` }, message));
        return;
      }

      const total = puzzle.characters.length;
      let correct = 0;
      for (const p of effective.placements) {
        const placed = state.placements.get(p.characterId);
        if (placed && placed.row === p.row && placed.col === p.col) correct++;
      }

      if (correct === total && state.placements.size === total) {
        solved = true;
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const previousBest = puzzle.bestTimeSeconds;
        stopTimer();
        await onSolved(elapsed);
        const murderer = murdererName(effective);
        const hintsUsedForThisSolve = state.hintsUsed;
        const newlyUnlocked = achievementsStore.recordSolve({ key: achievementKey, elapsedSeconds: elapsed, hintsUsed: hintsUsedForThisSolve });
        // `bestTimeSeconds` only exists on puzzles onSolved actually tracks it
        // for (single-puzzle play, via playerApp.js) — campaign mode's onSolved
        // doesn't set it, so this block simply doesn't render there instead of
        // needing a separate flag.
        let timeLine = null;
        if (typeof puzzle.bestTimeSeconds === "number") {
          const isNewBest = previousBest == null || elapsed <= previousBest;
          timeLine = el(
            "div",
            { class: "time-result" },
            isNewBest
              ? `⏱ Tempo: ${formatElapsed(elapsed)} — nuovo record personale!`
              : `⏱ Tempo: ${formatElapsed(elapsed)} (miglior tempo: ${formatElapsed(puzzle.bestTimeSeconds)})`
          );
        }
        const hintLine = el(
          "div",
          { class: "hint-result" },
          hintsUsedForThisSolve === 0 ? "🎉 Risolto senza alcun suggerimento!" : `💡 Suggerimenti usati: ${hintsUsedForThisSolve}`
        );
        const achievementBanner = newlyUnlocked.length > 0
          ? el(
              "div",
              { class: "achievement-banner" },
              newlyUnlocked.map((a) =>
                el("div", { class: "achievement-unlocked" }, [
                  el("div", { class: "achievement-unlocked-title" }, `🏆 Nuovo traguardo: ${a.title}`),
                  el("p", { class: "achievement-unlocked-desc" }, a.description),
                ])
              )
            )
          : null;
        resultEl.appendChild(
          el("div", { class: "win-panel result-banner success" }, [
            el("div", {}, "🎉 Caso risolto! Tutti i piazzamenti sono corretti."),
            murderer ? el("div", {}, `L'assassino è: ${murderer}`) : null,
            timeLine,
            hintLine,
            achievementBanner,
            puzzle.resolutionNote ? el("p", { class: "resolution-note" }, puzzle.resolutionNote) : null,
          ])
        );
      } else {
        // Deliberately doesn't say how many are right — that would let you brute
        // force it by trial and error instead of reasoning from the clues.
        resultEl.appendChild(el("div", { class: "result-banner partial" }, "Non è ancora tutto corretto. Continua a dedurre dagli indizi."));
      }
    } catch (err) {
      clear(resultEl);
      resultEl.appendChild(el("div", { class: "result-banner hint-error" }, `Non sono riuscito a verificare la soluzione: ${err.message}. Riprova.`));
    } finally {
      submitBtn.disabled = solved;
    }
  }

  function renderBriefing() {
    clear(briefingEl);
    briefingEl.classList.toggle("hidden", !puzzle.briefing);
    if (puzzle.briefing) {
      briefingEl.appendChild(el("h3", {}, "Il caso"));
      briefingEl.appendChild(el("p", {}, puzzle.briefing));
    }
  }

  function wireControls() {
    undoBtn.addEventListener("click", () => {
      clearHint();
      undo(state);
      markUnsolved();
      persistProgress();
      renderToolbar();
      renderBoardAndClues();
    });
    attachHoldToConfirm(clearBtn, 700, () => {
      clearHint();
      clearAll(state);
      markUnsolved();
      persistProgress();
      renderToolbar();
      renderBoardAndClues();
      clear(resultEl);
    });
    hintBtn.addEventListener("click", onHint);
    submitBtn.addEventListener("click", onSubmit);
  }

  // Full initial setup — render, notes hint text, briefing, timer, and every
  // control's event listener — replacing what each caller used to do inline
  // right after loading its puzzle. Call once, after `puzzle`/`state` are
  // both ready; there's no teardown/re-init support since both callers are
  // full-page-navigation apps where this only ever runs once per page load.
  function start() {
    renderToolbar();
    renderBoardAndClues();
    renderBriefing();
    clear(resultEl);
    startTimer();
    wireControls();
  }

  return { start };
}
