import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "./SideNav";

type MobileNavDrawerProps = {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
};

export default function MobileNavDrawer({ activeSection, onNavigate }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="mobile-nav-button" type="button" onClick={() => setOpen(true)} aria-label="打开目录">
        <Menu size={20} />
        目录
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="mobile-nav-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.nav
              className="mobile-nav-drawer"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 28, mass: 0.8 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="drawer-heading">
                <strong>Love Chronicle</strong>
                <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="关闭目录">
                  <X size={18} />
                </button>
              </div>
              {navItems.map((item, index) => (
                <button
                  key={item.id}
                  className={activeSection === item.id ? "active" : ""}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setOpen(false);
                  }}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                </button>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
