import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, authStorage, currentSessionId } from "./api/client";
import CheckinSection from "./components/CheckinSection";
import CountdownSection from "./components/CountdownSection";
import CoverGate from "./components/CoverGate";
import FloatingHearts from "./components/FloatingHearts";
import HeartPhotoWall from "./components/HeartPhotoWall";
import LoveCalendar from "./components/LoveCalendar";
import LoveDaysSection from "./components/LoveDaysSection";
import LettersSection from "./components/LettersSection";
import MusicPlayer, { MusicPlayerHandle } from "./components/MusicPlayer";
import PreferencesSection from "./components/PreferencesSection";
import ProfileMenu from "./components/ProfileMenu";
import SideNav from "./components/SideNav";
import WaveAudioVisualizer from "./components/WaveAudioVisualizer";
import { heartPhotos } from "./data/mockPhotos";
import { siteConfig } from "./data/siteConfig";
import { useActiveSection } from "./hooks/useActiveSection";
import type { AudioEnergy } from "./hooks/useAudioAnalyser";
import { useLoveSettings } from "./hooks/useLoveSettings";
import { useResponsive } from "./hooks/useResponsive";

const sectionIds = ["home", "days", "countdowns", "letters", "preferences", "checkins"];

function App() {
  const [entered, setEntered] = useState(() => authStorage.hasToken());
  const [audioEnergy, setAudioEnergy] = useState<AudioEnergy>({ average: 0, bass: 0, frequencies: [] });
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [autoPlayToken, setAutoPlayToken] = useState(0);
  const musicPlayerRef = useRef<MusicPlayerHandle>(null);
  const sectionVisitRef = useRef({ sectionId: "home", startedAt: Date.now() });
  const sessionStartedAtRef = useRef(Date.now());
  const activeSection = useActiveSection(sectionIds);
  const { isMobile } = useResponsive();
  const [settings] = useLoveSettings();

  const cssVars = useMemo(
    () =>
      ({
        "--theme-primary": siteConfig.theme.primary,
        "--theme-secondary": siteConfig.theme.secondary,
        "--theme-accent": siteConfig.theme.accent
      }) as CSSProperties,
    []
  );

  const navigateTo = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!entered) return;
    void api.recordPageView(`${window.location.pathname}${window.location.hash}`);
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    const sendHeartbeat = () => {
      void api.recordHeartbeat({
        moduleId: sectionVisitRef.current.sectionId,
        durationMs: Date.now() - sessionStartedAtRef.current,
        sessionId: currentSessionId()
      }).catch(() => undefined);
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 20000);
    return () => window.clearInterval(timer);
  }, [entered]);

  useEffect(() => {
    if (!entered) return;
    const previous = sectionVisitRef.current;
    const now = Date.now();
    if (previous.sectionId && now - previous.startedAt > 900) {
      void api.recordModuleView({ moduleId: previous.sectionId, durationMs: now - previous.startedAt });
    }
    sectionVisitRef.current = { sectionId: activeSection, startedAt: now };
  }, [activeSection, entered]);

  useEffect(() => {
    if (!entered) return;
    const flushCurrentSection = () => {
      const current = sectionVisitRef.current;
      const durationMs = Date.now() - current.startedAt;
      if (durationMs < 900) return;
      const payload = JSON.stringify({ moduleId: current.sectionId, durationMs });
      fetch("http://127.0.0.1:18080/api/visits/module-view", {
        method: "POST",
        body: payload,
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "X-Love-Session": currentSessionId(),
          ...(localStorage.getItem(authStorage.tokenKey) ? { Authorization: `Bearer ${localStorage.getItem(authStorage.tokenKey)}` } : {})
        }
      }).catch(() => undefined);
      sectionVisitRef.current = { sectionId: current.sectionId, startedAt: Date.now() };
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushCurrentSection();
    };
    window.addEventListener("beforeunload", flushCurrentSection);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      flushCurrentSection();
      window.removeEventListener("beforeunload", flushCurrentSection);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [entered]);

  return (
    <div className="app-shell" style={cssVars}>
      <FloatingHearts effect={settings.visualEffect} />
      <AnimatePresence>
        {!entered && (
          <CoverGate
            onEnter={() => {
              musicPlayerRef.current?.play();
              setEntered(true);
              setAutoPlayToken((value) => value + 1);
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="main-experience"
        initial={{ opacity: 0 }}
        animate={{ opacity: entered ? 1 : 0 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden={!entered}
      >
        {entered && !isMobile && <SideNav activeSection={activeSection} onNavigate={navigateTo} />}

        <main>
          <section className="section home-section" id="home">
            <div className="home-copy">
              <p className="eyebrow">Love Chronicle · {siteConfig.coupleName}</p>
              <h1 className="hero-title">
                <span>把温柔瞬间拼成一颗心</span>
              </h1>
            </div>
            <HeartPhotoWall photos={heartPhotos} />
            <WaveAudioVisualizer energy={audioEnergy} isPlaying={isMusicPlaying} />
          </section>

          <section className="section" id="days">
            <LoveDaysSection />
            <LoveCalendar />
          </section>

          <section className="section" id="countdowns">
            <CountdownSection />
          </section>

          <section className="section" id="letters">
            <LettersSection />
          </section>

          <section className="section" id="preferences">
            <PreferencesSection />
          </section>

          <section className="section" id="checkins">
            <CheckinSection />
          </section>
        </main>

        <MusicPlayer
          ref={musicPlayerRef}
          visible={entered}
          onEnergy={setAudioEnergy}
          onPlayingChange={setIsMusicPlaying}
          autoPlayToken={autoPlayToken}
        />
        {entered && <ProfileMenu onSwitchAccount={() => {
          musicPlayerRef.current?.pause();
          window.location.reload();
        }} />}
      </motion.div>
    </div>
  );
}

export default App;
