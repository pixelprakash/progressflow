import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CRITERION_KEYS, REVIEW_PROMPTS, REVIEW_TEXT_MAX, levelLabel } from '@progressflow/shared';
import type { PeerCandidate, PerformanceLevel, TKey } from '@progressflow/shared';
import { ApiError, api } from '../api';
import { useApi } from '../data';
import { useLang } from '../i18n';
import { useStudent } from './session';

const LEVELS: PerformanceLevel[] = [1, 2, 3, 4];
const CHOICES = ['yes', 'partly', 'not_yet'] as const;

/** Guided, two-step review: rate each criterion, then answer a few questions. Used for self and peer review. */
export function ReviewForm({ kind }: { kind: 'self' | 'peer' }) {
  const { id } = useParams();
  const { t, lang, guides } = useLang();
  const { portal, refresh, expire } = useStudent();
  const peers = useApi<PeerCandidate[]>(
    kind === 'peer' ? '/v1/student/peer' : '/v1/student/portal',
    expire,
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [scores, setScores] = useState<Record<string, PerformanceLevel>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState<string>('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const pages =
    kind === 'self'
      ? portal?.pieces.find((p) => p.id === id)?.pages
      : (peers.data as PeerCandidate[] | null)?.find?.((c) => c.id === id)?.pages;
  const prompts = REVIEW_PROMPTS[kind];
  const back = kind === 'self' ? '/student' : '/student/peer';
  const rated = CRITERION_KEYS.every((k) => scores[k]);
  const textPrompts = prompts.filter((p) => p !== 'sure');
  const written =
    textPrompts.every((p) => (text[p] ?? '').trim().length > 0) &&
    (kind === 'peer' || choice !== '');

  async function send() {
    if (!written) return setError(t('rv.needText'));
    setBusy(true);
    setError('');
    try {
      await api.post('/v1/student/reviews', {
        kind,
        submissionId: id,
        scores,
        answers: prompts.map((p) =>
          p === 'sure'
            ? { promptKey: p, choice, text: '' }
            : { promptKey: p, choice: null, text: (text[p] ?? '').trim() },
        ),
      });
      await refresh();
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t('rv.already') : t('rv.failed'));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="card center">
        <h1>✓</h1>
        <p className="lead">{kind === 'peer' ? t('rv.sentPeer') : t('rv.sent')}</p>
        <Link className="btn-link" to={back}>
          {t('sp.backHome')}
        </Link>
      </section>
    );
  }
  if (!pages)
    return (
      <p className="muted">
        {t('common.loading')} <Link to={back}>{t('common.back')}</Link>
      </p>
    );

  return (
    <>
      <p>
        <Link to={back}>← {t('common.back')}</Link>
      </p>
      <h1>{kind === 'self' ? t('rv.selfTitle') : t('rv.peerTitle')}</h1>
      <div className="review-images">
        {pages.map((p) => (
          <img key={p.id} src={`/v1/media/page/${p.id}`} alt="" />
        ))}
      </div>
      <p className="muted" aria-live="polite">
        {t('rv.step', { n: step, m: 2 })}
      </p>

      {step === 1 && (
        <>
          <p>{t('rv.rateIntro')}</p>
          {guides.map((g) => (
            <fieldset key={g.key} className="card rate" style={{ borderLeftColor: g.color }}>
              <legend>
                <strong>{g.name}</strong> <span className="muted small">{g.tagline}</span>
              </legend>
              <div className="levels" role="radiogroup">
                {LEVELS.map((l) => (
                  <label key={l} className="level">
                    <input
                      type="radio"
                      name={g.key}
                      value={l}
                      checked={scores[g.key] === l}
                      onChange={() => setScores({ ...scores, [g.key]: l })}
                    />
                    <span className="lv">
                      <b>{l}</b>
                      <small>{levelLabel(lang, l)}</small>
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="linkish"
                aria-expanded={hint === g.key}
                onClick={() => setHint(hint === g.key ? null : g.key)}
              >
                {hint === g.key ? t('rv.hideHint') : t('rv.hint')}
              </button>
              {hint === g.key && (
                <div className="hint-body">
                  <ul>
                    {g.lookFor.map((l) => (
                      <li key={l.title}>
                        <strong>{l.title}.</strong> {l.text}
                      </li>
                    ))}
                  </ul>
                  <ol className="level-text">
                    {LEVELS.map((l) => (
                      <li key={l} className={scores[g.key] === l ? 'on' : ''}>
                        <b>{l}</b> {g.levels[l]}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </fieldset>
          ))}
          {!rated && <p className="muted small">{t('rv.pick')}</p>}
          <button className="primary big" disabled={!rated} onClick={() => setStep(2)}>
            {t('common.next')}
          </button>
        </>
      )}

      {step === 2 && (
        <>
          {kind === 'peer' && (
            <p className="notice">
              {t('rv.anon')} {t('rv.kind')}
            </p>
          )}
          {textPrompts.map((p) => {
            const label = t(`rv.${kind}.${p}` as TKey);
            const value = text[p] ?? '';
            return (
              <div key={p} className="field">
                <label htmlFor={`q-${p}`}>{label}</label>
                <textarea
                  id={`q-${p}`}
                  rows={3}
                  maxLength={REVIEW_TEXT_MAX}
                  value={value}
                  onChange={(e) => setText({ ...text, [p]: e.target.value })}
                  aria-describedby={`c-${p}`}
                />
                <span id={`c-${p}`} className="muted small">
                  {value.length}/{REVIEW_TEXT_MAX}
                </span>
              </div>
            );
          })}
          {kind === 'self' && (
            <fieldset className="field">
              <legend>{t('rv.self.sure')}</legend>
              <div className="choices" role="radiogroup">
                {CHOICES.map((c) => (
                  <label key={c} className="choice">
                    <input
                      type="radio"
                      name="sure"
                      value={c}
                      checked={choice === c}
                      onChange={() => setChoice(c)}
                    />
                    <span>{t(`rv.choice.${c}` as TKey)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row gap">
            <button className="ghost big" onClick={() => setStep(1)}>
              {t('common.back')}
            </button>
            <button className="primary big" disabled={busy || !written} onClick={() => void send()}>
              {t('common.send')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
