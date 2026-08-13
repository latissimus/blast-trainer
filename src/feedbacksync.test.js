import { describe, expect, it, vi } from 'vitest';
import { createFeedbackAusgang } from './feedbacksync.js';

const ausgang = ({ online = true, senden = vi.fn().mockResolvedValue() } = {}) => {
  let liste = [];
  const queue = createFeedbackAusgang({
    lesen: () => JSON.parse(JSON.stringify(liste)),
    schreiben: (neu) => { liste = JSON.parse(JSON.stringify(neu)); },
    senden,
    istOnline: () => online,
  });
  return { queue, senden, liste: () => liste };
};

describe('Feedback-Ausgang', () => {
  it('behaelt Feedback offline lokal', async () => {
    const { queue, senden, liste } = ausgang({ online: false });
    queue.vormerken({ token: 'a', nachricht: 'Eine sinnvolle Idee' });

    await expect(queue.synchronisieren()).resolves.toEqual({ status: 'offline', wartend: 1 });
    expect(senden).not.toHaveBeenCalled();
    expect(liste()).toHaveLength(1);
  });

  it('entfernt Feedback erst nach bestaetigtem Versand', async () => {
    const { queue, senden, liste } = ausgang();
    queue.vormerken({ token: 'a', nachricht: 'Eine sinnvolle Idee' });

    await expect(queue.synchronisieren()).resolves.toEqual({ status: 'gesendet', wartend: 0 });
    expect(senden).toHaveBeenCalledTimes(1);
    expect(liste()).toEqual([]);
  });

  it('verliert Feedback bei einem Serverfehler nicht', async () => {
    const senden = vi.fn().mockRejectedValue(new Error('Netz langsam'));
    const { queue, liste } = ausgang({ senden });
    queue.vormerken({ token: 'a', nachricht: 'Eine sinnvolle Idee' });

    const result = await queue.synchronisieren();
    expect(result.status).toBe('fehler');
    expect(liste()).toHaveLength(1);
  });
});
