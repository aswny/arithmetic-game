import './styles.css';
import { ratingCost } from './engine/rating.js';
import { loadProfile, saveProfile, saveRun, loadHistory } from './game/storage';
import { displayRating } from './game/tiers';
import type { Profile, Session } from './game/types';
import { startScreen } from './ui/startScreen';
import { sprintScreen } from './ui/sprintScreen';
import { revealScreen } from './ui/revealScreen';

const app = document.getElementById('app')!;
let profile: Profile = loadProfile();

const show = (node: HTMLElement): void => { app.replaceChildren(node); };

function goHome(): void {
  show(startScreen(profile, goSprint));
}

function goSprint(): void {
  const ratingBefore = ratingCost(profile);
  const isFirstRun = loadHistory().length === 0;
  show(sprintScreen(profile, ({ session }) => goReveal(session, ratingBefore, isFirstRun)));
}

function goReveal(session: Session, ratingBefore: number, isFirstRun: boolean): void {
  // The session mutated `profile` in place as the run went on; persist it now
  // that the run is actually over.
  const rating = ratingCost(profile);
  saveProfile(profile);
  saveRun({
    at: Date.now(),
    solved: session.solved,
    missed: session.missed,
    items: session.items,
    rating,
    delta: displayRating(rating) - displayRating(ratingBefore),
  });
  show(revealScreen(profile, session, ratingBefore, isFirstRun, goSprint, goHome));
}

goHome();
