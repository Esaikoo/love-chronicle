import { motion } from "framer-motion";

type SideNavProps = {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
};

export const navItems = [
  { id: "home", label: "首页" },
  { id: "days", label: "日历" },
  { id: "countdowns", label: "约定" },
  { id: "letters", label: "信箱" },
  { id: "preferences", label: "喜好" },
  { id: "checkins", label: "打卡" }
];

function getCircularOffset(index: number, activeIndex: number) {
  const length = navItems.length;
  let offset = (index - activeIndex + length) % length;
  if (offset > Math.floor(length / 2)) offset -= length;
  return offset;
}

export default function SideNav({ activeSection, onNavigate }: SideNavProps) {
  const activeIndex = Math.max(0, navItems.findIndex((item) => item.id === activeSection));

  return (
    <nav className="side-nav refined carousel-nav" aria-label="页面导航">
      <div className="nav-track">
        {navItems.map((item, index) => {
          const active = item.id === activeSection;
          const offset = getCircularOffset(index, activeIndex);
          return (
            <motion.button
              key={item.id}
              className={active ? "active" : ""}
              type="button"
              onClick={() => onNavigate(item.id)}
              animate={{
                y: offset * 43 - 18,
                x: active ? 10 : 0,
                opacity: active ? 1 : Math.abs(offset) === 2 ? 0.38 : 0.62,
                scale: active ? 1.05 : 0.94
              }}
              transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.84 }}
              style={{ zIndex: active ? 3 : 2 - Math.abs(offset) }}
            >
              <b>{item.label}</b>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
