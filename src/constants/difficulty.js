export const formatDifficultyLabel = (difficulty) => {
  if (difficulty === null || difficulty === undefined || difficulty === '') {
    return 'Lv. -'
  }
  return `Lv. ${difficulty}`
}
