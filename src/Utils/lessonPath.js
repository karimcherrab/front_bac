export function safeChapterCode(
  value,
  chapterId,
) {
  const normalized = String(
    value ||
    `chapter-${chapterId}`,
  )
    .trim()
    .replace(/\s+/g, "-")
    .replace(/\/+/g, "-");

  return encodeURIComponent(
    normalized || `chapter-${chapterId}`,
  );
}


export function buildLessonPath(
  subjectId,
  chapterId,
  chapterCode,
) {
  return (
    `/subjects/${subjectId}`
    + `/lesson/${chapterId}`
    + `/${safeChapterCode(
      chapterCode,
      chapterId,
    )}`
  );
}
