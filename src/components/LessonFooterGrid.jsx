import { ResourcesCard, QuickExampleCard, GoalCard } from "./InfoCards";
import { sidePanels } from "../data/lessonData";

export default function LessonFooterGrid() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
      <ResourcesCard data={sidePanels.resources} />
      <QuickExampleCard data={sidePanels.quickExample} />
      <GoalCard data={sidePanels.goal} />
    </div>
  );
}
