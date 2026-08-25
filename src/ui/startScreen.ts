import { ratingCost } from '../engine/rating.js';
import { bestSolved, loadHistory } from '../game/storage';
import { tierFor, displayRating } from '../game/tiers';
import type { Profile } from '../game/types';
import { el } from './dom';

export function startScreen(profile: Profile, onPlay: () => void): HTMLElement {
  const screen = el('div', 'screen start');
  const history = loadHistory();
  const played = history.length > 0;

  const mark = el('div', 'start__mark', '+');
  const heading = el('div');
  heading.append(
    el('h1', 'start__title', 'NumberDash'),
    el('p', 'start__sub', played
      ? 'Two minutes. Every answer teaches it something about how you calculate.'
      : 'Two minutes of arithmetic. Answers submit themselves — just type the digits.'),
  );

  const play = el('button', 'button', played ? 'Play' : 'Start');
  play.type = 'button';
  play.addEventListener('click', onPlay);

  screen.append(mark, heading);

  if (played) {
    const rating = ratingCost(profile);
    const stats = el('div', 'start__stats');
    const stat = (value: string, label: string) => {
      const wrap = el('div', 'stat');
      wrap.append(el('span', 'stat__value', value), el('span', 'stat__label', label));
      return wrap;
    };
    stats.append(
      stat(String(displayRating(rating)), 'Rating'),
      stat(tierFor(rating).name, 'Tier'),
      stat(String(bestSolved(history)), 'Best'),
    );
    screen.append(stats);
  }

  screen.append(play);
  return screen;
}
