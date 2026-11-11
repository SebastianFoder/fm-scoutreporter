import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SquadClient from "./SquadClient";

const meta = {
  title: "Pages/Squad analysis",
  component: SquadClient,
  parameters: {
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/squad" } },
  },
} satisfies Meta<typeof SquadClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoImport: Story = {};

/** No squad yet, but a player import that can be used as the squad. */
export const PlayerImportOnly: Story = {
  parameters: { appProviders: { players: "fm26" } },
};

/** FM27 Squad view export: team sheet, squad status, injuries, loans and coach stars, no CA/PA. */
export const Imported: Story = {
  parameters: { appProviders: { squad: "squad" } },
};

/** The same squad from the Squad Hidden Attributes view: potential scores and projected prospects. */
export const HiddenAttributes: Story = {
  parameters: { appProviders: { squad: "squadHidden" } },
};

/** A plain player export (no squad columns) used as the squad, with one goalkeeper (so no keeper cover). */
export const PlayerExportAsSquad: Story = {
  parameters: { appProviders: { squad: "fm26" } },
};

/** Squad plus a separate scouting import, so the upgrades table fills in. */
export const WithScoutingImport: Story = {
  parameters: { appProviders: { squad: "squad", players: "fm27outfield" } },
};

/** Outfield-only squad: nobody can play in goal. */
export const MissingPositions: Story = {
  parameters: { appProviders: { squad: "fm27outfield" } },
};
