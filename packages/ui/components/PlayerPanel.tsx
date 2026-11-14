"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import type { PlayerWithGroups } from "@scoutreporter/core/players";
import { usePlayersData } from "./PlayersDataProvider";
import { useSquadData } from "./SquadDataProvider";
import { PlayerProfile } from "@scoutreporter/ui/features/attribute/players/PlayerProfile";

type PlayerPanelValue = {
  /**
   * Show a player in the side panel. Returns false when the player is in neither the player nor
   * the squad import (the caller then lets its link open the player page as usual).
   */
  openPlayer: (id: string, opener?: HTMLElement | null) => boolean;
  close: () => void;
  /** The player in the panel, or null. */
  openId: string | null;
};

const PlayerPanelContext = createContext<PlayerPanelValue | null>(null);

/**
 * The player side panel: clicking a player anywhere in the app (see PlayerLink) shows their
 * profile in a panel docked on the right, over the page. It is not modal, so another player in
 * the table behind it can be clicked straight away; Esc or the close button closes it, and so
 * does leaving the page.
 */
export function PlayerPanelProvider({ children }: { children: React.ReactNode }) {
  const { state: playersState } = usePlayersData();
  const { state: squadState } = useSquadData();
  const pathname = usePathname();
  // The panel belongs to the page it was opened on: on another page it is closed.
  const [opened, setOpened] = useState<{ id: string; path: string } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const openId = opened && opened.path === pathname ? opened.id : null;

  const find = useCallback(
    (id: string): PlayerWithGroups | undefined =>
      playersState.players.find((p) => p.raw.uniqueId === id) ?? squadState.players.find((p) => p.raw.uniqueId === id),
    [playersState.players, squadState.players],
  );

  const openPlayer = useCallback(
    (id: string, opener?: HTMLElement | null) => {
      if (!find(id)) return false;
      openerRef.current = opener ?? null;
      setOpened({ id, path: pathname });
      return true;
    },
    [find, pathname],
  );

  const close = useCallback(() => {
    setOpened(null);
    // Back to the link that opened it, for keyboard users.
    openerRef.current?.focus?.();
    openerRef.current = null;
  }, []);

  const value = useMemo(() => ({ openPlayer, close, openId }), [openPlayer, close, openId]);
  const player = openId ? find(openId) : undefined;

  return (
    <PlayerPanelContext.Provider value={value}>
      {children}
      {player && <PlayerSidePanel player={player} onClose={close} />}
    </PlayerPanelContext.Provider>
  );
}

/** The side panel, or null outside PlayerPanelProvider. */
export function usePlayerPanel(): PlayerPanelValue | null {
  return useContext(PlayerPanelContext);
}

function PlayerSidePanel({ player, onClose }: { player: PlayerWithGroups; onClose: () => void }) {
  const ref = useRef<HTMLElement | null>(null);
  const headingId = useId();
  const id = player.raw.uniqueId;

  // Move focus into the panel whenever it shows a new player, and scroll it back to the top.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelector("[data-panel-body]")?.scrollTo?.(0, 0);
    el.focus({ preventScroll: true });
  }, [id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A modal opened on top (weights, thresholds) handles its own Esc.
      if (e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <aside
      ref={ref}
      tabIndex={-1}
      aria-labelledby={headingId}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[40rem] flex-col border-l border-line bg-paper text-ink shadow-[-8px_0_24px_oklch(0.15_0.01_255/0.16)] outline-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
        <p className="text-[13px] font-semibold text-muted">Player</p>
        <div className="flex items-center gap-1">
          <Link
            href={`/players/${id}`}
            className="btn h-8 gap-1.5 rounded-md px-2.5 text-[13px] text-muted hover:bg-ink/6 hover:text-ink"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Full page
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn h-8 w-8 justify-center rounded-md text-muted hover:bg-ink/6 hover:text-ink"
            aria-label="Close player panel"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <div data-panel-body className="flex-1 overflow-y-auto px-4 py-4">
        <PlayerProfile key={id} player={player} layout="panel" headingId={headingId} />
      </div>
    </aside>,
    document.body,
  );
}

/**
 * A link to a player. A plain click shows them in the side panel; Ctrl/Cmd-click, middle-click and
 * "open in new tab" still open the player page, and without the panel (or for a player who is not
 * imported) it is an ordinary link.
 */
export function PlayerLink({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const panel = usePlayerPanel();
  const open = panel?.openId === id;
  return (
    <Link
      href={`/players/${id}`}
      className={className}
      aria-current={open ? "true" : undefined}
      onClick={(e) => {
        if (!panel || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (panel.openPlayer(id, e.currentTarget)) e.preventDefault();
      }}
    >
      {children}
    </Link>
  );
}
