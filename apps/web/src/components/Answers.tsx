import type { ReviewAnswer } from '@progressflow/shared';
import type { TKey } from '@progressflow/shared';
import { useLang } from '../i18n';

/** A review's written answers, each under the question it answers. */
export function Answers({ kind, answers }: { kind: 'self' | 'peer'; answers: ReviewAnswer[] }) {
  const { t } = useLang();
  return (
    <dl className="answers">
      {answers.map((a) => (
        <div key={a.promptKey}>
          <dt>{t(`rv.${kind}.${a.promptKey}` as TKey)}</dt>
          <dd>{a.choice ? t(`rv.choice.${a.choice}` as TKey) : a.text}</dd>
        </div>
      ))}
    </dl>
  );
}
