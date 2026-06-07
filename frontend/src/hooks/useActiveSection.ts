import { useEffect, useState } from "react";

export function useActiveSection(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const referenceLine = window.innerHeight * 0.38;
      const sections = sectionIds
        .map((id) => ({ id, element: document.getElementById(id) }))
        .filter((item): item is { id: string; element: HTMLElement } => Boolean(item.element));
      if (sections.length === 0) return;

      const next = sections.reduce((closest, section) => {
        const rect = section.element.getBoundingClientRect();
        const containsLine = rect.top <= referenceLine && rect.bottom > referenceLine;
        if (containsLine) return { id: section.id, distance: 0 };
        const distance = Math.min(Math.abs(rect.top - referenceLine), Math.abs(rect.bottom - referenceLine));
        return distance < closest.distance ? { id: section.id, distance } : closest;
      }, { id: sections[0].id, distance: Number.POSITIVE_INFINITY });

      setActiveSection((current) => current === next.id ? current : next.id);
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sectionIds]);

  return activeSection;
}
