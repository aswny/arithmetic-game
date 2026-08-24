import { ratingCost } from '../engine/rating.js';
import { tierFor, tierProgress, displayRating } from '../game/tiers';
import type { Profile, Session } from '../game/types';
import { el } from './dom';

const FACET_LABELS: Record<string, string> = {
  'add.retrieve': 'Add, facts',
  'add.plain': 'Add',
  'add.carry': 'Add, carry',
  'sub.retrieve': 'Subtract, facts',
  'sub.plain': 'Subtract',
  'sub.borrow': 'Subtract, borrow',
  'mul.table': 'Times table',
  'mul.multi': 'Multiply',
  'div.exact': 'Divide',
};

// A facet needs a few observations before its estimate means anything; charting
// one measured twice would show the prior, not the player.
const MIN_OBSERVATIONS = 3;

interface FacetRow { facet: string; rating: number; share: number; }

function facetRows(profile: Profile, session: Session): FacetRow[] {
  const runCounts = new Map<string, number>();
  for (const item of session.log) runCounts.set(item.facet, (runCounts.get(item.facet) ?? 0) + 1);

  return Object.keys(FACET_LABELS)
    .filter((f) => (profile.facetN[f] ?? 0) >= MIN_OBSERVATIONS)
    .map((facet) => ({
      facet,
      rating: ratingCost(profile, facet),
      share: session.items ? (runCounts.get(facet) ?? 0) / session.items : 0,
    }))
    .sort((a, b) => a.rating - b.rating);
}

function dotPlot(rows: FacetRow[], overall: number): HTMLElement {
  const wrap = el('div');
  const values = rows.map((r) => r.rating).concat(overall);
  const lo = Math.floor(Math.min(...values) * 2) / 2 - 0.25;
  const hi = Math.ceil(Math.max(...values) * 2) / 2 + 0.25;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const plot = el('div', 'plot');
  rows.forEach((row, i) => {
    const line = el('div', `frow${i === 0 ? ' frow--weakest' : ''}`);
    const track = el('div', 'frow__track');
    const dot = el('span', 'frow__dot');
    dot.style.left = `${pct(row.rating)}%`;
    // Every value is also written out beside the dot, so nothing is hidden
    // behind a hover the player may not have a pointer for.
    dot.title = `${FACET_LABELS[row.facet]}: ${displayRating(row.rating)}`;
    track.append(dot);
    line.append(
      el('span', 'frow__name', FACET_LABELS[row.facet]),
      track,
      el('span', 'frow__value', String(displayRating(row.rating))),
    );
    plot.append(line);
  });

  const ref = el('div', 'plot__ref');
  // The reference line sits inside the shared track column, which starts after
  // the fixed-width name column and ends before the value column.
  ref.style.left = `calc(6.75rem + .5rem + (100% - 6.75rem - 2.25rem - 1rem) * ${pct(overall) / 100})`;
  plot.append(ref);

  // The endpoints are labelled with what the axis means, not with its numbers:
  // nobody reasons in rating units, and every dot already carries its value.
  const axis = el('div', 'plot__axis');
  const span = el('div', 'plot__axis-span');
  span.append(el('span', undefined, 'slower'), el('span', undefined, 'faster'));
  axis.append(el('span'), span, el('span'));

  const legend = el('div', 'plot__legend');
  legend.append(
    el('b', undefined, 'Rating by skill'),
    document.createTextNode(` — the line is your overall ${displayRating(overall)}.`),
  );

  wrap.append(plot, axis, legend);
  return wrap;
}

export function revealScreen(
  profile: Profile,
  session: Session,
  ratingBefore: number,
  isFirstRun: boolean,
  onAgain: () => void,
  onHome: () => void,
): HTMLElement {
  const screen = el('div', 'screen reveal');
  const inner = el('div', 'reveal__inner');
  const rating = ratingCost(profile);
  const delta = displayRating(rating) - displayRating(ratingBefore);
  const tier = tierFor(rating);

  const score = el('h1', 'reveal__score', String(session.solved));
  score.append(el('small', undefined, `solved · ${session.missed} missed`));
  inner.append(el('p', 'reveal__eyebrow', 'Sprint complete'), score);

  // --- rating ---
  const ratingCard = el('div', 'card');
  ratingCard.append(el('p', 'card__title', 'Rating'));
  const row = el('div', 'rating__row');
  row.append(el('span', 'rating__value', String(displayRating(rating))));
  if (!isFirstRun) {
    const sign = delta >= 0 ? '+' : '−';
    row.append(el('span', `rating__delta${delta < 0 ? ' rating__delta--down' : ''}`,
      `${sign}${Math.abs(delta)}`));
  }
  row.append(el('span', 'rating__tier', tier.name));
  const meter = el('div', 'meter');
  const meterFill = el('div', 'meter__fill');
  meterFill.style.width = `${Math.round(tierProgress(rating) * 100)}%`;
  meter.append(meterFill);
  ratingCard.append(row, meter);
  ratingCard.append(el('p', 'reveal__note',
    isFirstRun
      ? 'That is your starting rating: the difficulty you can hold at about two and a half seconds per problem.'
      : 'Your rating is the difficulty you can hold at about two and a half seconds per problem.'));
  inner.append(ratingCard);

  // --- per-facet breakdown ---
  const rows = facetRows(profile, session);
  if (rows.length >= 3) {
    const facetCard = el('div', 'card');
    facetCard.append(el('p', 'card__title', 'Where the time went'));
    facetCard.append(dotPlot(rows, rating));

    const busiest = [...rows].sort((a, b) => b.share - a.share)[0];
    const weakest = rows[0];
    const note = el('p', 'reveal__note');
    if (busiest.facet === weakest.facet && busiest.share > 0.15) {
      note.append(
        document.createTextNode(`${Math.round(busiest.share * 100)}% of this run went to `),
        el('strong', undefined, FACET_LABELS[busiest.facet].toLowerCase()),
        document.createTextNode(' — currently your slowest. That is deliberate.'),
      );
    } else {
      note.append(
        document.createTextNode('Your slowest skill is '),
        el('strong', undefined, FACET_LABELS[weakest.facet].toLowerCase()),
        document.createTextNode('. Expect to see more of it next run.'),
      );
    }
    facetCard.append(note);
    inner.append(facetCard);
  }

  // --- actions ---
  const actions = el('div', 'reveal__actions');
  const again = el('button', 'button', 'Play again');
  again.type = 'button';
  again.addEventListener('click', onAgain);
  const home = el('button', 'button button--quiet', 'Home');
  home.type = 'button';
  home.addEventListener('click', onHome);
  actions.append(again, home);
  inner.append(actions);

  screen.append(inner);
  return screen;
}
