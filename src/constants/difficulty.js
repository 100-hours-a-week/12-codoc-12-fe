export const formatDifficultyLabel = (difficulty) => {
  if (difficulty === null || difficulty === undefined || difficulty === '') {
    return 'LV -'
  }
  const levelMap = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  }
  const resolved = levelMap[difficulty] ?? difficulty
  return `LV ${resolved}`
}
