// The battle world: the backdrop, Scratch Boy at his DJ table, the opponent and his rigs. It plays
// the store's queued events one at a time, in order, and lands each event's values on the displayed
// state at its impact moment. It never works out an outcome: every value comes from an event or
// from the displayed state.
import { PALETTE } from '@scratchboy/content';
import { rigStatus, type BattleEvent, type BattleState, type SideIndex } from '@scratchboy/core';
import { GameObjects, Scene, TintModes } from 'phaser';
import { PANEL_HEIGHT } from '../battle/layout.ts';
import {
  battleStore,
  finishBatch,
  landEvent,
  OPPONENT,
  PLAYER,
  reportRigBoxes,
  type Batch,
  type BattleStore,
  type RigBox,
} from '../battle/store.ts';
import { reducedMotion } from '../motion.ts';
import { BACKDROP, SHEETS, slugOf, tagFrame, type SheetName } from '../sprites.ts';

// --- Where things stand, in backdrop image pixels (art/sprites/*.ts in content) ---------------

/** backdrop-hiphop.ts SPOT_HERO: the DJ table is centred on it. */
const HERO_SPOT = { x: 140, y: 130 };
/** The hero spot's centre sits this far above the panel (the art's own 320x180 layout). */
const HERO_SPOT_ABOVE_PANEL = 8;
/** dj-table.ts: DJ_END, MODULE_W, CAP, DECK_DX, DECK_Y, HERO_DX, HERO_DY (Scratch Boy's frame
 *  top-left from the table's). The table's height is read from its sheet. */
const TABLE = { djEnd: 24, module: 42, cap: 4, deckDx: 1, deckY: -10, heroDx: -10, heroDy: -46 };
const TABLE_HEIGHT = SHEETS['dj-table'].json.frames[0]?.frame.h ?? 0;
/** scratch-boy.ts: the centre of his ground shadow, in his frame. */
const BOY = { originX: 22 };
/** turntable.ts: RECORD_X/RECORD_Y, where the record and its label sit on the turntable frame. */
const RECORD = { x: 4, y: 4 };
const TURNTABLE = { w: 40, h: 28 };
/** Riff stands in the streetlight's pool (SPOT_FOE), his amp on his right. */
const RIFF_AT = { x: 300, y: 59 };
const AMP_AT = { x: 357, y: 83 };
/** The opaque part of each opponent sprite frame: what the screen treats as the rig. */
const RIFF_BOX = { x: 10, y: 3, w: 46, h: 61 };
const AMP_BOX = { x: 2, y: 3, w: 30, h: 36 };
/** Left edge of Scratch Boy's pixels and right edge of the amp's: the fight is centred between. */
const FIGHT_LEFT = 78;
const FIGHT_RIGHT = 389;

const FX = 16;
const MAX_RECORD_FRAME = 7;
/** A turn of the player's that ends by itself (nothing ready): the screen holds on it for a beat, so
 *  "your turn, no free hand" can be seen before it passes. */
const SKIPPED_TURN_MS = 600;
const SKIPPED_TURN_REDUCED_MS = 300;
/** How long a record rests after turning back one step of cooldown, so the step can be seen. */
const TICK_HOLD_MS = 240;
const TICK_HOLD_REDUCED_MS = 120;
/** How far the old record lifts off the platter, and the new one comes down from, in a swap. */
const SWAP_LIFT = 2;

/** The indexes of the player's turn-started events whose turn ends within the same step: turns
 *  that end by themselves. */
function skippedTurns(events: readonly BattleEvent[]): Set<number> {
  const skipped = new Set<number>();
  let start: number | null = null;
  events.forEach((event, i) => {
    if (event.type === 'turn-started') start = event.side === PLAYER ? i : null;
    else if (event.type === 'turn-ended' && event.side === PLAYER && start !== null) {
      skipped.add(start);
      start = null;
    }
  });
  return skipped;
}

/** dj-table.ts's battle layering: the table, its turntables, Scratch Boy, then the table's DJ end
 *  again, which hides his legs while his scratching hand stays over the first record. */
const DEPTH = { fill: 0, backdrop: 1, amp: 10, riff: 11, table: 20, deck: 21, boy: 22, djEnd: 23, shield: 30, fx: 40 };

const colour = (name: keyof typeof PALETTE): number => parseInt(PALETTE[name].slice(1), 16);

/** A rig's on-screen node (shaken and flashed as a whole) and its box inside that node. */
interface RigNode {
  node: GameObjects.Container;
  box: { x: number; y: number; w: number; h: number };
  shield: GameObjects.Sprite;
}

interface Deck extends RigNode {
  turntable: GameObjects.Sprite;
  record: GameObjects.Sprite;
  label: GameObjects.Sprite;
  frame: number;
}

export class BattleScene extends Scene {
  private backdrops: GameObjects.Image[] = [];
  private skyFill!: GameObjects.Rectangle;
  private groundFill!: GameObjects.Rectangle;
  private boy!: GameObjects.Sprite;
  private tables: GameObjects.Image[] = [];
  private djEnd!: GameObjects.Image;
  private decks: Deck[] = [];
  /** Riff's container holds him and his guitar (rig 0); the amp's holds the amp (rig 1). */
  private riff!: GameObjects.Sprite;
  private amp!: GameObjects.Sprite;
  private foe: RigNode[] = [];
  /** Sprites playing a one-off animation: their resting pose waits for it to end. */
  private acting = new Set<GameObjects.Sprite>();
  /** Where each node rests, so a shake always comes back to the laid-out spot. */
  private rest = new Map<GameObjects.Container, { x: number; y: number }>();
  private playing = false;

  constructor() {
    super('battle');
  }

  preload(): void {
    for (const [key, sheet] of Object.entries(SHEETS)) this.load.aseprite(key, sheet.png, sheet.json);
    this.load.image(BACKDROP.key, BACKDROP.png);
  }

  create(): void {
    for (const key of Object.keys(SHEETS)) this.anims.createFromAseprite(key);
    this.cameras.main.setBackgroundColor(colour('ink-1'));
    this.skyFill = this.add.rectangle(0, 0, 1, 1, colour('ink-1')).setOrigin(0).setDepth(DEPTH.fill);
    this.groundFill = this.add.rectangle(0, 0, 1, 1, colour('ink-2')).setOrigin(0).setDepth(DEPTH.fill);
    this.boy = this.add.sprite(0, 0, 'scratch-boy').setOrigin(0).setDepth(DEPTH.boy);
    this.djEnd = this.add.image(0, 0, 'dj-table', '0').setOrigin(0).setDepth(DEPTH.djEnd);

    this.resetFight();
    this.scale.on('resize', this.layout, this);
    const unsubscribe = battleStore().subscribe((state, previous) => this.onStore(state, previous));
    const stop = (): void => {
      unsubscribe();
      this.scale.off('resize', this.layout, this);
    };
    this.events.once('shutdown', stop);
    this.events.once('destroy', stop);
  }

  // ------------------------------------------------------------------------------ store

  private onStore(state: BattleStore, previous: BattleStore): void {
    if (state.fight !== previous.fight) {
      this.resetFight();
      return;
    }
    if (state.batches !== previous.batches) this.pump();
    const turnOrWinner = state.shown.turn.side !== previous.shown.turn.side || state.shown.winner !== previous.shown.winner;
    if (turnOrWinner || state.talk !== previous.talk) {
      this.updatePoses();
    }
  }

  private shown(): BattleState {
    return battleStore().getState().shown;
  }

  /** Builds the rigs for the current fight and shows its displayed state. */
  private resetFight(): void {
    const state = battleStore().getState();
    for (const deck of this.decks) deck.node.destroy();
    for (const rig of this.foe) rig.node.destroy();
    this.acting.clear();
    this.rest.clear();
    this.decks = state.shown.sides[PLAYER].rigs.map(() => this.makeDeck());
    this.foe = this.makeOpponent(state.shown);
    this.layout();
    this.syncAll();
    this.pump();
  }

  private makeDeck(): Deck {
    const turntable = this.add.sprite(0, 0, 'turntable').setOrigin(0);
    const record = this.add.sprite(RECORD.x, RECORD.y, 'vinyl').setOrigin(0);
    const label = this.add.sprite(RECORD.x, RECORD.y, 'vinyl-label').setOrigin(0);
    const shield = this.add.sprite(TURNTABLE.w - 12, -6, 'fx').setOrigin(0).setVisible(false);
    const node = this.add.container(0, 0, [turntable, record, label, shield]).setDepth(DEPTH.deck);
    return { node, turntable, record, label, shield, frame: 0, box: { x: 0, y: 0, ...TURNTABLE } };
  }

  /** M1 draws one opponent: Riff, his guitar (on him) and his amp. */
  private makeOpponent(shown: BattleState): RigNode[] {
    const fighter = shown.sides[OPPONENT];
    if (fighter.id !== 'opponent/riff') throw new Error(`no battle art for '${fighter.id}'`);
    return fighter.rigs.map((rig) => {
      const onRiff = rig.id === 'rig/riff-guitar';
      if (!onRiff && rig.id !== 'rig/riff-amp') throw new Error(`no battle art for '${rig.id}'`);
      const sprite = this.add.sprite(0, 0, onRiff ? 'riff' : 'amp').setOrigin(0);
      if (onRiff) this.riff = sprite;
      else this.amp = sprite;
      const box = onRiff ? RIFF_BOX : AMP_BOX;
      const shield = this.add.sprite(box.x + box.w - 12, box.y - 4, 'fx').setOrigin(0).setVisible(false);
      const node = this.add.container(0, 0, [sprite, shield]).setDepth(onRiff ? DEPTH.riff : DEPTH.amp);
      return { node, box, shield };
    });
  }

  // ------------------------------------------------------------------------------ layout

  /** Places everything for the current view size, and tells the UI where the rigs are. */
  private layout(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setSize(width, height);
    const sceneHeight = height - PANEL_HEIGHT;
    const ox = Math.floor(width / 2 - (FIGHT_LEFT + FIGHT_RIGHT) / 2);
    const oy = sceneHeight - HERO_SPOT_ABOVE_PANEL - HERO_SPOT.y;

    // The backdrop repeats sideways (its edges tile); flat sky above it, flat asphalt below.
    const first = ox - Math.ceil(ox / BACKDROP.width) * BACKDROP.width;
    const count = Math.ceil((width - first) / BACKDROP.width);
    while (this.backdrops.length < count) {
      this.backdrops.push(this.add.image(0, 0, BACKDROP.key).setOrigin(0).setDepth(DEPTH.backdrop));
    }
    this.backdrops.forEach((image, i) => image.setPosition(first + i * BACKDROP.width, oy).setVisible(i < count));
    this.skyFill.setPosition(0, 0).setSize(width, Math.max(0, oy));
    this.groundFill.setPosition(0, oy + BACKDROP.height).setSize(width, Math.max(0, height - oy - BACKDROP.height));

    // Scratch Boy's DJ table, centred on the hero spot for two turntables, one module per turntable.
    const decks = this.decks.length;
    const tableX = ox + HERO_SPOT.x - (TABLE.djEnd + 2 * TABLE.module + TABLE.cap) / 2;
    const tableY = oy + HERO_SPOT.y - Math.floor(TABLE_HEIGHT / 2);
    this.layoutTable(tableX, tableY, decks);
    this.boy.setPosition(tableX + TABLE.heroDx, tableY + TABLE.heroDy);
    this.djEnd.setCrop(0, 0, TABLE.djEnd, TABLE_HEIGHT).setPosition(tableX, tableY);
    this.decks.forEach((deck, i) => {
      this.place(deck.node, tableX + TABLE.djEnd + i * TABLE.module + TABLE.deckDx, tableY + TABLE.deckY);
    });

    const [guitar, amp] = this.foe;
    if (guitar) this.place(guitar.node, ox + RIFF_AT.x, oy + RIFF_AT.y);
    if (amp) this.place(amp.node, ox + AMP_AT.x, oy + AMP_AT.y);

    reportRigBoxes(PLAYER, this.decks.map((deck) => this.boxOf(deck)));
    reportRigBoxes(OPPONENT, this.foe.map((rig) => this.boxOf(rig)));
  }

  /** The table sprite is table(2): the DJ end and module 0, then module 1 once per further deck, then the cap. */
  private layoutTable(x: number, y: number, decks: number): void {
    const pieces: { from: number; to: number }[] = [{ from: 0, to: TABLE.djEnd + TABLE.module }];
    const second = { from: TABLE.djEnd + TABLE.module, to: TABLE.djEnd + 2 * TABLE.module };
    for (let i = 1; i < decks; i++) pieces.push(second);
    pieces.push({ from: second.to, to: second.to + TABLE.cap });
    while (this.tables.length < pieces.length) {
      this.tables.push(this.add.image(0, 0, 'dj-table', '0').setOrigin(0).setDepth(DEPTH.table));
    }
    let at = x;
    this.tables.forEach((image, i) => {
      const piece = pieces[i];
      image.setVisible(piece !== undefined);
      if (!piece) return;
      image.setCrop(piece.from, 0, piece.to - piece.from, TABLE_HEIGHT).setPosition(at - piece.from, y);
      at += piece.to - piece.from;
    });
  }

  private place(node: GameObjects.Container, x: number, y: number): void {
    node.setPosition(x, y);
    this.rest.set(node, { x, y });
  }

  private boxOf(rig: RigNode): RigBox {
    const at = this.rest.get(rig.node) ?? { x: rig.node.x, y: rig.node.y };
    return { x: at.x + rig.box.x, y: at.y + rig.box.y, w: rig.box.w, h: rig.box.h };
  }

  // ------------------------------------------------------------------------------ showing the displayed state

  /** Every sprite matches the displayed state exactly. */
  private syncAll(): void {
    const shown = this.shown();
    this.decks.forEach((_, i) => this.syncDeck(i, shown));
    this.foe.forEach((_, i) => this.syncShield(OPPONENT, i, shown));
    this.updatePoses();
  }

  /** A working turntable shows its record, turned by its cooldown, with the vinyl's label. A broken
   *  one shows the bare broken turntable: its record is gone. */
  private syncDeck(index: number, shown: BattleState = this.shown()): void {
    const deck = this.decks[index];
    const rig = shown.sides[PLAYER].rigs[index];
    if (!deck || !rig) return;
    const status = rigStatus(shown, PLAYER, index);
    const working = status.state !== 'broken';
    deck.turntable.setFrame(this.frameOf('turntable', working ? 'turntable-ready' : 'turntable-broken'));
    this.liftRecord(deck, 0);
    this.setRecord(deck, Math.min(status.cooldown, MAX_RECORD_FRAME));
    deck.record.setVisible(working);
    this.setLabel(deck, working ? rig.deck : null);
    this.syncShield(PLAYER, index, shown);
  }

  /** The label of this vinyl on the record, or none. An undrawn label leaves the record bare. */
  private setLabel(deck: Deck, vinyl: string | null): void {
    const label = vinyl === null ? null : tagFrame('vinyl-label', `vinyl-label-${slugOf(vinyl)}`);
    deck.label.setVisible(label !== null);
    if (label) deck.label.setFrame(label.filename);
  }

  /** Raises the record and its label `dy` pixels off the platter (0 = resting on it). */
  private liftRecord(deck: Deck, dy: number): void {
    deck.record.setY(RECORD.y - dy);
    deck.label.setY(RECORD.y - dy);
  }

  private setRecord(deck: Deck, frame: number): void {
    deck.frame = frame;
    deck.record.setFrame(String(frame));
  }

  private syncShield(side: SideIndex, index: number, shown: BattleState = this.shown(), animate = false): void {
    const rig = shown.sides[side].rigs[index];
    const node = this.rigNode(side, index);
    if (!rig || !node) return;
    const up = rigStatus(shown, side, index).shield > 0;
    node.shield.setVisible(up);
    if (up && animate && !reducedMotion()) node.shield.play('shield');
    else if (up && !node.shield.anims.isPlaying) node.shield.setFrame(this.frameOf('fx', 'shield'));
  }

  private rigNode(side: SideIndex, index: number): RigNode | undefined {
    return side === PLAYER ? this.decks[index] : this.foe[index];
  }

  /** Resting poses: the side on turn moves to the beat (it is that side's turn), or while an opening
   *  line is said, its speaker (he is the one talking); the loser is down. */
  private updatePoses(): void {
    const shown = this.shown();
    const line = battleStore().getState().talk[0];
    const moving = line ? shown.sides.findIndex((side) => side.id === line.speaker) : shown.turn.side;
    const riffSide = shown.sides[OPPONENT];
    const guitarIndex = riffSide.rigs.findIndex((rig) => rig.id === 'rig/riff-guitar');
    const ampIndex = riffSide.rigs.findIndex((rig) => rig.id === 'rig/riff-amp');
    const guitarBroken = (riffSide.rigs[guitarIndex]?.hp ?? 1) <= 0;
    const ampBroken = (riffSide.rigs[ampIndex]?.hp ?? 1) <= 0;
    const over = shown.winner !== null;
    const onTurn = (side: SideIndex): boolean => !over && moving === side;

    if (shown.winner === OPPONENT && this.hasTag('scratch-boy-down')) this.pose(this.boy, 'scratch-boy-down', false);
    else this.pose(this.boy, 'scratch-boy-idle', onTurn(PLAYER));

    if (shown.winner === PLAYER) this.pose(this.riff, 'riff-down', false);
    else this.pose(this.riff, guitarBroken ? 'riff-noguitar' : 'riff-idle', onTurn(OPPONENT));

    this.pose(this.amp, ampBroken ? 'amp-broken' : 'amp-idle', false);
  }

  private pose(sprite: GameObjects.Sprite, tag: string, loop: boolean): void {
    if (this.acting.has(sprite)) return;
    if (loop && !reducedMotion()) {
      sprite.play({ key: tag, repeat: -1 }, true);
    } else {
      sprite.anims.stop();
      sprite.setFrame(this.frameOf(this.sheetOf(sprite), tag));
    }
  }

  /** Plays a one-off animation, then goes back to the resting pose. */
  private act(sprite: GameObjects.Sprite, tag: string): void {
    if (!this.hasTag(tag)) return;
    if (reducedMotion()) {
      sprite.anims.stop();
      sprite.setFrame(this.frameOf(this.sheetOf(sprite), tag));
      this.acting.add(sprite);
      this.time.delayedCall(120, () => {
        this.acting.delete(sprite);
        this.updatePoses();
      });
      return;
    }
    this.acting.add(sprite);
    sprite.play(tag);
    sprite.once('animationcomplete', () => {
      this.acting.delete(sprite);
      this.updatePoses();
    });
  }

  private sheetOf(sprite: GameObjects.Sprite): SheetName {
    return sprite.texture.key as SheetName;
  }

  private hasTag(tag: string): boolean {
    return this.anims.exists(tag);
  }

  private frameOf(sheet: SheetName, tag: string): string {
    return tagFrame(sheet, tag)?.filename ?? '0';
  }

  // ------------------------------------------------------------------------------ playing events

  private pump(): void {
    if (this.playing) return;
    const state = battleStore().getState();
    const batch = state.batches[0];
    if (!batch) return;
    this.playing = true;
    const fight = state.fight;
    void this.playBatch(fight, batch).finally(() => {
      this.playing = false;
      if (battleStore().getState().fight === fight) this.syncAll();
      this.pump();
    });
  }

  private async playBatch(fight: number, batch: Batch): Promise<void> {
    const skipped = skippedTurns(batch.events);
    for (const [i, event] of batch.events.entries()) {
      if (battleStore().getState().fight !== fight) return;
      await this.playEvent(fight, event, skipped.has(i));
    }
    finishBatch(fight, batch);
  }

  private wait(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** One event: a short animation that says what changed, with its values landing at the impact. */
  private async playEvent(fight: number, event: BattleEvent, skippedTurn: boolean): Promise<void> {
    const still = reducedMotion();
    const land = (): void => landEvent(fight, event);
    switch (event.type) {
      case 'battle-started':
      case 'turn-ended':
        land();
        return;
      case 'turn-started':
        land();
        this.updatePoses();
        if (skippedTurn) await this.wait(still ? SKIPPED_TURN_REDUCED_MS : SKIPPED_TURN_MS);
        else await this.wait(still ? 0 : 160);
        return;
      case 'scratched':
        this.attack(event.side, event.rig);
        await this.wait(still ? 40 : 160);
        land();
        return;
      case 'cooldown-started':
        land();
        if (event.side === PLAYER) await this.turnRecord(event.rig, event.turns);
        return;
      case 'cooldown-ticked':
        land();
        if (event.side === PLAYER) {
          await this.turnRecord(event.rig, event.cooldown);
          await this.wait(still ? TICK_HOLD_REDUCED_MS : TICK_HOLD_MS);
        } else {
          await this.wait(still ? 0 : 60);
        }
        return;
      case 'hit': {
        land();
        this.burst('spark', event.side, event.rig, 'centre');
        this.flash(event.side, event.rig);
        if (!still) this.shake(event.side, event.rig);
        await this.wait(still ? 60 : 340);
        return;
      }
      case 'blocked':
        land();
        this.burst('shield', event.side, event.rig, 'centre');
        this.syncShield(event.side, event.rig);
        await this.wait(still ? 60 : 300);
        return;
      case 'shield-raised':
        land();
        this.syncShield(event.side, event.rig, this.shown(), true);
        await this.wait(still ? 60 : 320);
        return;
      case 'shield-faded':
        land();
        this.syncShield(event.side, event.rig);
        await this.wait(still ? 0 : 80);
        return;
      case 'trap-set':
        land();
        // Only the player's own trap shows where it is.
        if (event.side === PLAYER && event.rig !== null) this.burst('trap', PLAYER, event.rig, 'centre');
        await this.wait(still ? 60 : 420);
        return;
      case 'trap-fired':
        land();
        this.burst('trap', event.side, event.rig, 'centre');
        await this.wait(still ? 60 : 420);
        return;
      case 'stunned':
        land();
        this.burst('stun', event.side, event.rig, 'top');
        if (event.side === PLAYER) await this.turnRecord(event.rig, event.cooldown);
        await this.wait(still ? 60 : 360);
        return;
      case 'slowed':
      case 'hasted':
        land();
        this.fighterBurst(event.type === 'slowed' ? 'slow' : 'haste', event.side);
        await this.wait(still ? 60 : 380);
        return;
      case 'rig-broken':
        land();
        if (event.side === PLAYER) this.syncDeck(event.rig);
        else this.updatePoses();
        this.syncShield(event.side, event.rig);
        this.burst('spark', event.side, event.rig, 'centre');
        this.flash(event.side, event.rig);
        await this.wait(still ? 60 : 480);
        return;
      case 'swapped':
        if (event.side === PLAYER) await this.swapRecord(event.rig, event.in, land);
        else land();
        return;
      case 'battle-won':
        land();
        this.updatePoses();
        await this.wait(still ? 120 : 900);
        return;
    }
  }

  private attack(side: SideIndex, rig: number): void {
    if (side === PLAYER) {
      this.act(this.boy, 'scratch-boy-scratch');
      return;
    }
    const id = this.shown().sides[OPPONENT].rigs[rig]?.id;
    if (id === 'rig/riff-guitar') this.act(this.riff, 'riff-attack');
    else if (id === 'rig/riff-amp') this.act(this.amp, 'amp-attack');
  }

  /** A swap: the old record lifts off and its label goes, the new one shows and comes down onto the
   *  platter. The swap lands as it touches down. */
  private async swapRecord(index: number, vinyl: string, land: () => void): Promise<void> {
    const deck = this.decks[index];
    if (!deck || reducedMotion()) {
      land();
      this.syncDeck(index);
      await this.wait(60);
      return;
    }
    deck.label.setVisible(false);
    this.liftRecord(deck, SWAP_LIFT);
    await this.wait(120);
    this.setLabel(deck, vinyl);
    await this.wait(100);
    land();
    this.syncDeck(index);
    await this.wait(120);
  }

  /** The record turns one step per turn of cooldown: away from rest as it starts, back as it ticks. */
  private async turnRecord(index: number, cooldown: number): Promise<void> {
    const deck = this.decks[index];
    if (!deck) return;
    const target = Math.min(Math.max(cooldown, 0), MAX_RECORD_FRAME);
    if (reducedMotion()) {
      this.setRecord(deck, target);
      return;
    }
    while (deck.frame !== target) {
      this.setRecord(deck, deck.frame + Math.sign(target - deck.frame));
      await this.wait(60);
    }
  }

  /** A one-off fx animation over a rig. */
  private burst(tag: string, side: SideIndex, index: number, at: 'centre' | 'top'): void {
    const node = this.rigNode(side, index);
    if (!node) return;
    const box = this.boxOf(node);
    const x = Math.round(box.x + box.w / 2 - FX / 2);
    const y = at === 'centre' ? Math.round(box.y + box.h / 2 - FX / 2) : box.y - FX / 2;
    this.fxAt(tag, x, y);
  }

  /** Slow and haste land on a fighter: the fx shows by his head. */
  private fighterBurst(tag: string, side: SideIndex): void {
    if (side === PLAYER) {
      this.fxAt(tag, this.boy.x + BOY.originX - FX / 2, this.boy.y - 4);
      return;
    }
    const riff = this.riff.parentContainer;
    const at = riff ? (this.rest.get(riff) ?? riff) : { x: 0, y: 0 };
    this.fxAt(tag, at.x + RIFF_BOX.x + 4, at.y - 2);
  }

  private fxAt(tag: string, x: number, y: number): void {
    const sprite = this.add.sprite(x, y, 'fx').setOrigin(0).setDepth(DEPTH.fx);
    if (reducedMotion()) {
      sprite.setFrame(this.frameOf('fx', tag));
      this.time.delayedCall(300, () => sprite.destroy());
      return;
    }
    sprite.play(tag);
    // Single-frame fx (slow, haste, trap) hold a moment; animated ones end with their last frame.
    sprite.once('animationcomplete', () => this.time.delayedCall(180, () => sprite.destroy()));
  }

  /** The hit rig flashes the palette's white for a moment. */
  private flash(side: SideIndex, index: number): void {
    const node = this.rigNode(side, index);
    if (!node) return;
    const sprites = node.node.list.filter(
      (child): child is GameObjects.Sprite => child instanceof GameObjects.Sprite && child !== node.shield,
    );
    for (const sprite of sprites) sprite.setTint(colour('ink-7')).setTintMode(TintModes.FILL);
    this.time.delayedCall(70, () => {
      for (const sprite of sprites) sprite.clearTint().setTintMode(TintModes.MULTIPLY);
    });
  }

  /** The hit rig jolts sideways by 2 px, then 1 px, then settles. */
  private shake(side: SideIndex, index: number): void {
    const node = this.rigNode(side, index)?.node;
    if (!node) return;
    [2, -2, 1, -1, 0].forEach((dx, i) => {
      this.time.delayedCall(i * 35, () => {
        const at = this.rest.get(node);
        if (at) node.setPosition(at.x + dx, at.y);
      });
    });
  }
}
