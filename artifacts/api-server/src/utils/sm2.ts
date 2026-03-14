export function calculateSM2(
  grade: number,
  repetition: number,
  interval: number,
  easeFactor: number,
) {
  let newInterval = interval;
  let newRepetition = repetition;
  let newEaseFactor = easeFactor;

  if (grade >= 3) {
    if (repetition === 0) newInterval = 1;
    else if (repetition === 1) newInterval = 6;
    else newInterval = Math.round(interval * easeFactor);
    newRepetition += 1;
  } else {
    newRepetition = 0;
    newInterval = 1;
  }

  newEaseFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    repetition: newRepetition,
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewDate,
  };
}
